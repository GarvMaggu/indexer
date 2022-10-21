"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApuKeyRateLimits = void 0;
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const rate_limit_rules_1 = require("@/models/rate-limit-rules");
exports.getApuKeyRateLimits = {
    description: "Get rate limits for the given API key",
    notes: "Get the rate limits for the given API key",
    tags: ["api", "Management"],
    plugins: {
        "hapi-swagger": {
            payloadType: "form",
            orders: 13,
        },
    },
    validate: {
        params: joi_1.default.object({
            key: joi_1.default.string().uuid().description("The API key"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            rateLimits: joi_1.default.array().items(joi_1.default.object({
                route: joi_1.default.string(),
                method: joi_1.default.string().allow(""),
                allowedRequests: joi_1.default.number(),
                perSeconds: joi_1.default.number(),
            })),
        }).label("getApiKeyRateLimitsResponse"),
        failAction: (_request, _h, error) => {
            logger_1.logger.error("get-api-key-rate-limit-handler", `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        try {
            const rules = await rate_limit_rules_1.RateLimitRules.getApiKeyRateLimits(params.key);
            return {
                rateLimits: lodash_1.default.map(rules, (rule) => ({
                    route: rule.route,
                    method: rule.method,
                    allowedRequests: rule.options.points,
                    perSeconds: rule.options.duration,
                })),
            };
        }
        catch (error) {
            logger_1.logger.error("get-api-key-rate-limit-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=get-api-key-rate-limits.js.map