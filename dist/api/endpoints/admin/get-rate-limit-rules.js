"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRateLimitRulesOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const rate_limit_rules_1 = require("@/models/rate-limit-rules");
exports.getRateLimitRulesOptions = {
    description: "Get rate limit rules",
    tags: ["api", "x-admin"],
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        query: joi_1.default.object({
            route: joi_1.default.string().description("The route to get rules for"),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const query = request.query;
        try {
            const rateLimitRules = await rate_limit_rules_1.RateLimitRules.getInstance();
            const rules = rateLimitRules.getAllRules();
            if (query.route) {
                const response = [];
                for (const rule of rules.values()) {
                    if (rule.route == query.route) {
                        response.push(rule);
                    }
                }
                return { rules: response };
            }
            return {
                rules: Array.from(rules.values()),
            };
        }
        catch (error) {
            logger_1.logger.error("post-update-api-key-tier-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=get-rate-limit-rules.js.map