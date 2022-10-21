"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = exports.inject = void 0;
const api_1 = require("@bull-board/api");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const hapi_1 = require("@bull-board/hapi");
const basic_1 = __importDefault(require("@hapi/basic"));
const boom_1 = require("@hapi/boom");
const hapi_2 = __importDefault(require("@hapi/hapi"));
const inert_1 = __importDefault(require("@hapi/inert"));
const vision_1 = __importDefault(require("@hapi/vision"));
const hapi_swagger_1 = __importDefault(require("hapi-swagger"));
const lodash_1 = __importDefault(require("lodash"));
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const qs_1 = __importDefault(require("qs"));
const routes_1 = require("@/api/routes");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
const index_2 = require("@/jobs/index");
const api_keys_1 = require("@/models/api-keys");
const rate_limit_rules_1 = require("@/models/rate-limit-rules");
let server;
const inject = (options) => server.inject(options);
exports.inject = inject;
const start = async () => {
    server = hapi_2.default.server({
        port: index_1.config.port,
        query: {
            parser: (query) => qs_1.default.parse(query),
        },
        router: {
            stripTrailingSlash: true,
        },
        routes: {
            cache: {
                privacy: "public",
                expiresIn: 1000,
            },
            timeout: {
                server: 10 * 1000,
            },
            cors: {
                origin: ["*"],
                additionalHeaders: ["x-api-key", "x-rkc-version", "x-rkui-version"],
            },
            // Expose any validation errors
            // https://github.com/hapijs/hapi/issues/3706
            validate: {
                failAction: (_request, _h, error) => {
                    // Remove any irrelevant information from the response
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    delete error.output.payload.validation;
                    throw error;
                },
            },
        },
    });
    // Register an authentication strategy for the BullMQ monitoring UI
    await server.register(basic_1.default);
    server.auth.strategy("simple", "basic", {
        validate: (_request, username, password) => {
            return {
                isValid: username === "admin" && password === index_1.config.bullmqAdminPassword,
                credentials: { username },
            };
        },
    });
    // Setup the BullMQ monitoring UI
    const serverAdapter = new hapi_1.HapiAdapter();
    (0, api_1.createBullBoard)({
        queues: index_2.allJobQueues.map((q) => new bullMQAdapter_1.BullMQAdapter(q)),
        serverAdapter,
    });
    serverAdapter.setBasePath("/admin/bullmq");
    await server.register({
        plugin: serverAdapter.registerPlugin(),
        options: {
            auth: "simple",
        },
    }, {
        routes: { prefix: "/admin/bullmq" },
    });
    // Getting rate limit instance will load rate limit rules into memory
    await rate_limit_rules_1.RateLimitRules.getInstance();
    const apiDescription = "You are viewing the reference docs for the Reservoir API.\
    \
    For a more complete overview with guides and examples, check out the <a href='https://reservoirprotocol.github.io'>Reservoir Protocol Docs</a>.";
    await server.register([
        {
            plugin: inert_1.default,
        },
        {
            plugin: vision_1.default,
        },
        {
            plugin: hapi_swagger_1.default,
            options: {
                grouping: "tags",
                security: [{ API_KEY: [] }],
                securityDefinitions: {
                    API_KEY: {
                        type: "apiKey",
                        name: "x-api-key",
                        in: "header",
                        "x-default": "demo-api-key",
                    },
                },
                schemes: ["https", "http"],
                host: `${index_1.config.chainId === 1 ? "api" : `api-${(0, network_1.getNetworkName)()}`}.reservoir.tools`,
                cors: true,
                tryItOutEnabled: true,
                documentationPath: "/",
                sortEndpoints: "ordered",
                info: {
                    title: "Reservoir API",
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    version: require("../../package.json").version,
                    description: apiDescription,
                },
            },
        },
    ]);
    server.ext("onPreAuth", async (request, reply) => {
        const key = request.headers["x-api-key"];
        const apiKey = await api_keys_1.ApiKeyManager.getApiKey(key);
        const tier = (apiKey === null || apiKey === void 0 ? void 0 : apiKey.tier) || 0;
        // Get the rule for the incoming request
        const rateLimitRules = await rate_limit_rules_1.RateLimitRules.getInstance();
        const rateLimitRule = rateLimitRules.getRule(request.route.path, request.route.method, tier, apiKey === null || apiKey === void 0 ? void 0 : apiKey.key);
        // If matching rule was found
        if (rateLimitRule) {
            // If the requested path has no limit
            if (rateLimitRule.points == 0) {
                return reply.continue;
            }
            const remoteAddress = request.headers["x-forwarded-for"]
                ? lodash_1.default.split(request.headers["x-forwarded-for"], ",")[0]
                : request.info.remoteAddress;
            const rateLimitKey = lodash_1.default.isUndefined(key) || lodash_1.default.isEmpty(key) || lodash_1.default.isNull(apiKey) ? remoteAddress : key; // If no api key or the api key is invalid use IP
            try {
                const rateLimiterRes = await rateLimitRule.consume(rateLimitKey, 1);
                if (rateLimiterRes) {
                    // Generate the rate limiting header and add them to the request object to be added to the response in the onPreResponse event
                    request.headers["X-RateLimit-Limit"] = `${rateLimitRule.points}`;
                    request.headers["X-RateLimit-Remaining"] = `${rateLimiterRes.remainingPoints}`;
                    request.headers["X-RateLimit-Reset"] = `${new Date(Date.now() + rateLimiterRes.msBeforeNext)}`;
                }
            }
            catch (error) {
                if (error instanceof rate_limiter_flexible_1.RateLimiterRes) {
                    if (error.consumedPoints &&
                        (error.consumedPoints == Number(rateLimitRule.points) + 1 ||
                            error.consumedPoints % 50 == 0)) {
                        const log = {
                            message: `${rateLimitKey} ${(apiKey === null || apiKey === void 0 ? void 0 : apiKey.appName) || ""} reached allowed rate limit ${rateLimitRule.points} requests in ${rateLimitRule.duration}s by calling ${error.consumedPoints} times on route ${request.route.path}${request.info.referrer ? ` from referrer ${request.info.referrer} ` : ""}`,
                            route: request.route.path,
                            appName: (apiKey === null || apiKey === void 0 ? void 0 : apiKey.appName) || "",
                            key: rateLimitKey,
                            referrer: request.info.referrer,
                        };
                        logger_1.logger.warn("rate-limiter", JSON.stringify(log));
                    }
                    const tooManyRequestsResponse = {
                        statusCode: 429,
                        error: "Too Many Requests",
                        message: `Max ${rateLimitRule.points} requests in ${rateLimitRule.duration}s reached`,
                    };
                    return reply
                        .response(tooManyRequestsResponse)
                        .type("application/json")
                        .code(429)
                        .takeover();
                }
                else {
                    logger_1.logger.error("rate-limiter", `Rate limit error ${error}`);
                }
            }
        }
        return reply.continue;
    });
    server.ext("onPreHandler", (request, h) => {
        api_keys_1.ApiKeyManager.logUsage(request);
        return h.continue;
    });
    server.ext("onPreResponse", (request, reply) => {
        const response = request.response;
        // Set custom response in case of timeout
        if ("isBoom" in response && "output" in response) {
            if (response["output"]["statusCode"] == 503) {
                const timeoutResponse = {
                    statusCode: 504,
                    error: "Gateway Timeout",
                    message: "Query cancelled because it took longer than 10s to execute",
                };
                return reply.response(timeoutResponse).type("application/json").code(504);
            }
        }
        if (!(response instanceof boom_1.Boom)) {
            response.header("X-RateLimit-Limit", request.headers["X-RateLimit-Limit"]);
            response.header("X-RateLimit-Remaining", request.headers["X-RateLimit-Remaining"]);
            response.header("X-RateLimit-Reset", request.headers["X-RateLimit-Reset"]);
        }
        return reply.continue;
    });
    (0, routes_1.setupRoutes)(server);
    await server.start();
    logger_1.logger.info("process", `Started on port ${index_1.config.port}`);
};
exports.start = start;
//# sourceMappingURL=index.js.map