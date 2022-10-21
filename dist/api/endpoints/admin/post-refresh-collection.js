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
exports.postRefreshCollectionOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const collectionsRefreshCache = __importStar(require("@/jobs/collections-refresh/collections-refresh-cache"));
const collectionUpdatesMetadata = __importStar(require("@/jobs/collection-updates/metadata-queue"));
const metadataIndexFetch = __importStar(require("@/jobs/metadata-index/fetch-queue"));
const orderFixes = __importStar(require("@/jobs/order-fixes/queue"));
const collections_1 = require("@/models/collections");
const opensea_indexer_api_1 = require("@/utils/opensea-indexer-api");
const tokens_1 = require("@/models/tokens");
exports.postRefreshCollectionOptions = {
    description: "Refresh a collection's orders and metadata",
    tags: ["api", "x-admin"],
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Refresh the given collection. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`")
                .required(),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const collection = await collections_1.Collections.getById(payload.collection);
            // If no collection found
            if (lodash_1.default.isNull(collection)) {
                throw Boom.badRequest(`Collection ${payload.collection} not found`);
            }
            // Update the last sync date
            const currentUtcTime = new Date().toISOString();
            await collections_1.Collections.update(payload.collection, { lastMetadataSync: currentUtcTime });
            // Update the collection id of any missing tokens
            await db_1.edb.none(`
          WITH x AS (
            SELECT
              collections.contract,
              collections.token_id_range
            FROM collections
            WHERE collections.id = $/collection/
          )
          UPDATE tokens SET
            collection_id = $/collection/,
            updated_at = now()
          FROM x
          WHERE tokens.contract = x.contract
            AND tokens.token_id <@ x.token_id_range
            AND tokens.collection_id IS NULL
        `, { collection: payload.collection });
            // Refresh the collection metadata
            let tokenId;
            if (lodash_1.default.isNull(collection.tokenIdRange)) {
                tokenId = await tokens_1.Tokens.getSingleToken(payload.collection);
            }
            else {
                tokenId = lodash_1.default.isEmpty(collection.tokenIdRange) ? "1" : `${collection.tokenIdRange[0]}`;
            }
            await collectionUpdatesMetadata.addToQueue(collection.contract, tokenId);
            // Refresh the contract floor sell and top bid
            await collectionsRefreshCache.addToQueue(collection.contract);
            // Revalidate the contract orders
            await orderFixes.addToQueue([{ by: "contract", data: { contract: collection.contract } }]);
            if (index_1.config.metadataIndexingMethod === "opensea") {
                // Refresh contract orders from OpenSea
                await opensea_indexer_api_1.OpenseaIndexerApi.fastContractSync(collection.contract);
            }
            // Refresh the collection tokens metadata
            await metadataIndexFetch.addToQueue([
                {
                    kind: "full-collection",
                    data: {
                        method: metadataIndexFetch.getIndexingMethod(collection.community),
                        collection: collection.id,
                    },
                },
            ], true);
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error(`post-collections-refresh-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-refresh-collection.js.map