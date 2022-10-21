"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenApiOptions = void 0;
const swagger2openapi_1 = __importDefault(require("swagger2openapi"));
const index_1 = require("@/api/index");
const logger_1 = require("@/common/logger");
// eslint-disable-next-line
const parseMethod = (object) => {
    if (object["get"]) {
        return object["get"];
    }
    else if (object["post"]) {
        return object["post"];
    }
    else if (object["put"]) {
        return object["put"];
    }
    else if (object["delete"]) {
        return object["delete"];
    }
};
exports.getOpenApiOptions = {
    description: "Get swagger json in OpenApi V3",
    tags: ["api", "x-admin"],
    timeout: {
        server: 10 * 1000,
    },
    handler: async () => {
        try {
            const response = await (0, index_1.inject)({
                method: "GET",
                url: "/swagger.json",
            });
            const swagger = JSON.parse(response.payload);
            const data = await swagger2openapi_1.default.convertObj(swagger, {
                patch: true,
                warnOnly: true,
            });
            data.openapi["servers"] = [
                {
                    url: "https://api.reservoir.tools",
                },
                {
                    url: "https://api-goerli.reservoir.tools",
                },
                {
                    url: "https://api-optimism.reservoir.tools",
                },
                {
                    url: "https://api-polygon.reservoir.tools",
                },
            ];
            data.openapi["paths"] = Object.fromEntries(
            // eslint-disable-next-line
            Object.entries(data.openapi["paths"]).sort((a, b) => {
                const aMethod = parseMethod(a[1]);
                const bMethod = parseMethod(b[1]);
                if (aMethod["tags"][0] < bMethod["tags"][0]) {
                    return -1;
                }
                if (aMethod["tags"][0] > bMethod["tags"][0]) {
                    return 1;
                }
                return 0;
            }));
            return data.openapi;
        }
        catch (error) {
            logger_1.logger.error("get-open-api-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=get-open-api.js.map