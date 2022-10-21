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
exports.postFlagTokenV1Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const tokens_1 = require("@/models/tokens");
const api_keys_1 = require("@/models/api-keys");
const pending_flag_status_sync_jobs_1 = require("@/models/pending-flag-status-sync-jobs");
const flagStatusProcessQueue = __importStar(require("@/jobs/flag-status/process-queue"));
const version = "v1";
exports.postFlagTokenV1Options = {
    description: "Update token flag status",
    tags: ["api", "Management"],
    plugins: {
        "hapi-swagger": {
            order: 13,
        },
    },
    validate: {
        payload: joi_1.default.object({
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/)
                .description("The token to update the flag status for. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`")
                .required(),
            flag: joi_1.default.number()
                .allow(0, 1)
                .description(`0 - Token is not flagged, 1 - Token is flagged`)
                .required(),
        }),
    },
    response: {
        schema: joi_1.default.object({
            message: joi_1.default.string(),
        }).label(`postFlagToken${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`post-flag-token-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const payload = request.payload;
        const [contract, tokenId] = payload.token.split(":");
        const token = await tokens_1.Tokens.getByContractAndTokenId(contract, tokenId);
        if (!token) {
            throw Boom.badData(`Token ${payload.token} not found`);
        }
        try {
            const currentUtcTime = new Date().toISOString();
            await tokens_1.Tokens.update(contract, tokenId, {
                isFlagged: payload.flag,
                lastFlagUpdate: currentUtcTime,
            });
            if (token.isFlagged != payload.flag) {
                const pendingFlagStatusSyncJobs = new pending_flag_status_sync_jobs_1.PendingFlagStatusSyncJobs();
                await pendingFlagStatusSyncJobs.add([
                    {
                        kind: "tokens",
                        data: {
                            collectionId: token.collectionId,
                            contract: contract,
                            tokens: [
                                {
                                    tokenId: tokenId,
                                    tokenIsFlagged: payload.flag,
                                },
                            ],
                        },
                    },
                ]);
                await flagStatusProcessQueue.addToQueue();
            }
            const key = request.headers["x-api-key"];
            const apiKey = await api_keys_1.ApiKeyManager.getApiKey(key);
            const remoteAddress = request.headers["x-forwarded-for"]
                ? lodash_1.default.split(request.headers["x-forwarded-for"], ",")[0]
                : request.info.remoteAddress;
            const callingUser = lodash_1.default.isUndefined(key) || lodash_1.default.isEmpty(key) || lodash_1.default.isNull(apiKey) ? remoteAddress : apiKey.appName; // If no api key or the api key is invalid use IP
            logger_1.logger.info(`post-flag-token-${version}-handler`, `${callingUser} updated ${payload.token} to ${payload.flag}`);
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error(`post-flag-token-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map