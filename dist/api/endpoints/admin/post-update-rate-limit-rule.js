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
exports.postUpdateRateLimitRuleOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const rate_limit_rules_1 = require("@/models/rate-limit-rules");
exports.postUpdateRateLimitRuleOptions = {
    description: "Update the rate limit for the given ID",
    tags: ["api", "x-admin"],
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            ruleId: joi_1.default.number().description("The rule ID to update").required(),
            tier: joi_1.default.number().valid(0, 1, 2, 3, 4, null).optional(),
            points: joi_1.default.number().optional(),
            duration: joi_1.default.number().optional(),
            apiKey: joi_1.default.string().uuid().optional().allow(""),
            method: joi_1.default.string().valid("get", "post", "delete", "put", "").optional(),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            await rate_limit_rules_1.RateLimitRules.update(payload.ruleId, {
                tier: payload.tier,
                method: payload.method,
                apiKey: payload.apiKey,
                options: {
                    points: payload.points,
                    duration: payload.duration,
                },
            });
            return {
                message: `Rule ID ${payload.ruleId} was updated with params=${JSON.stringify(payload)}`,
            };
        }
        catch (error) {
            logger_1.logger.error("post-update-rate-limit-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-update-rate-limit-rule.js.map