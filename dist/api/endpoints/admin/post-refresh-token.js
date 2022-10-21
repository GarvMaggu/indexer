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
exports.postRefreshTokenOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const metadataIndexFetch = __importStar(require("@/jobs/metadata-index/fetch-queue"));
const orderFixes = __importStar(require("@/jobs/order-fixes/queue"));
const resyncAttributeCache = __importStar(require("@/jobs/update-attribute/resync-attribute-cache"));
const tokenRefreshCacheQueue = __importStar(require("@/jobs/token-updates/token-refresh-cache"));
const collections_1 = require("@/models/collections");
const tokens_1 = require("@/models/tokens");
const opensea_indexer_api_1 = require("@/utils/opensea-indexer-api");
exports.postRefreshTokenOptions = {
    description: "Refresh a token's orders and metadata",
    tags: ["api", "x-admin"],
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/)
                .description("Refresh the given token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`")
                .required(),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const [contract, tokenId] = payload.token.split(":");
            const token = await tokens_1.Tokens.getByContractAndTokenId(contract, tokenId, true);
            // If no token found
            if (lodash_1.default.isNull(token)) {
                throw Boom.badRequest(`Token ${payload.token} not found`);
            }
            // Update the last sync date
            const currentUtcTime = new Date().toISOString();
            await tokens_1.Tokens.update(contract, tokenId, { lastMetadataSync: currentUtcTime });
            if (index_1.config.metadataIndexingMethod === "opensea") {
                // Refresh orders from OpenSea
                await opensea_indexer_api_1.OpenseaIndexerApi.fastTokenSync(payload.token);
            }
            // Refresh meta data
            const collection = await collections_1.Collections.getByContractAndTokenId(contract, tokenId);
            if (collection) {
                await metadataIndexFetch.addToQueue([
                    {
                        kind: "single-token",
                        data: {
                            method: metadataIndexFetch.getIndexingMethod(collection.community),
                            contract,
                            tokenId,
                            collection: collection.id,
                        },
                    },
                ], true);
            }
            // Revalidate the token orders
            await orderFixes.addToQueue([{ by: "token", data: { token: payload.token } }]);
            // Revalidate the token attribute cache
            await resyncAttributeCache.addToQueue(contract, tokenId, 0);
            // Refresh the token floor sell and top bid
            await tokenRefreshCacheQueue.addToQueue(contract, tokenId);
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error(`post-tokens-refresh-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-refresh-token.js.map