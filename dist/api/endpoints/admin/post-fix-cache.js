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
exports.postFixCacheOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const collections_1 = require("@/models/collections");
exports.postFixCacheOptions = {
    description: "Trigger fixing any cache inconsistencies for array of contracts.",
    tags: ["api", "x-admin"],
    timeout: {
        server: 2 * 60 * 1000,
    },
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            kind: joi_1.default.string().valid("tokens-floor-sell", "tokens-top-buy").required(),
            contracts: joi_1.default.array().items(joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .required()),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const kind = payload.kind;
            const contracts = payload.contracts;
            switch (kind) {
                case "tokens-floor-sell": {
                    for (const contract of contracts) {
                        await collections_1.Collections.recalculateContractFloorSell(contract);
                    }
                    break;
                }
                case "tokens-top-buy": {
                    for (const contract of contracts) {
                        await collections_1.Collections.recalculateContractTopBuy(contract);
                    }
                    break;
                }
            }
            return { message: "Success" };
        }
        catch (error) {
            logger_1.logger.error("post-fix-cache-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-fix-cache.js.map