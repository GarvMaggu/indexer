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
exports.postCollectionsRefreshV1Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const date_fns_1 = require("date-fns");
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
const api_keys_1 = require("@/models/api-keys");
const tokens_1 = require("@/models/tokens");
const version = "v1";
exports.postCollectionsRefreshV1Options = {
    description: "Refresh Collection",
    tags: ["api", "Collections"],
    plugins: {
        "hapi-swagger": {
            order: 13,
        },
    },
    validate: {
        headers: joi_1.default.object({
            "x-api-key": joi_1.default.string(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Refresh the given collection. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`")
                .required(),
            overrideCoolDown: joi_1.default.boolean()
                .default(false)
                .description("If true, will force a refresh regardless of cool down. Requires an authorized api key to be passed."),
            metadataOnly: joi_1.default.boolean()
                .default(false)
                .description("If true, will only refresh the collection metadata."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            message: joi_1.default.string(),
        }).label(`postCollectionsRefresh${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`post-collections-refresh-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a;
        const payload = request.payload;
        let refreshCoolDownMin = 60 * 4; // How many minutes between each refresh
        let overrideCoolDown = false;
        try {
            if (payload.overrideCoolDown) {
                const apiKey = await api_keys_1.ApiKeyManager.getApiKey(request.headers["x-api-key"]);
                if (lodash_1.default.isNull(apiKey)) {
                    throw Boom.unauthorized("Invalid API key");
                }
                if (!((_a = apiKey.permissions) === null || _a === void 0 ? void 0 : _a.override_collection_refresh_cool_down)) {
                    throw Boom.unauthorized("Not allowed");
                }
                overrideCoolDown = true;
            }
            const collection = await collections_1.Collections.getById(payload.collection);
            // If no collection found
            if (lodash_1.default.isNull(collection)) {
                throw Boom.badRequest(`Collection ${payload.collection} not found`);
            }
            const currentUtcTime = new Date().toISOString();
            if (payload.metadataOnly) {
                // Refresh the collection metadata
                let tokenId;
                if (lodash_1.default.isNull(collection.tokenIdRange)) {
                    tokenId = await tokens_1.Tokens.getSingleToken(payload.collection);
                }
                else {
                    tokenId = lodash_1.default.isEmpty(collection.tokenIdRange) ? "1" : `${collection.tokenIdRange[0]}`;
                }
                await collectionUpdatesMetadata.addToQueue(collection.contract, tokenId, 0, true);
            }
            else {
                const isLargeCollection = collection.tokenCount > 30000;
                if (!overrideCoolDown) {
                    // For large collections allow refresh once a day
                    if (isLargeCollection) {
                        refreshCoolDownMin = 60 * 24;
                    }
                    // Check when the last sync was performed
                    const nextAvailableSync = (0, date_fns_1.add)(new Date(collection.lastMetadataSync), {
                        minutes: refreshCoolDownMin,
                    });
                    if (!lodash_1.default.isNull(collection.lastMetadataSync) && (0, date_fns_1.isAfter)(nextAvailableSync, Date.now())) {
                        throw Boom.tooEarly(`Next available sync ${(0, date_fns_1.formatISO9075)(nextAvailableSync)} UTC`);
                    }
                }
                // Update the last sync date
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
                await collectionUpdatesMetadata.addToQueue(collection.contract, tokenId, 0, payload.overrideCoolDown);
                // Refresh the contract floor sell and top bid
                await collectionsRefreshCache.addToQueue(collection.contract);
                // Revalidate the contract orders
                await orderFixes.addToQueue([{ by: "contract", data: { contract: collection.contract } }]);
                // Do these refresh operation only for small collections
                if (!isLargeCollection) {
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
                }
            }
            logger_1.logger.info(`post-collections-refresh-${version}-handler`, `Refresh collection=${payload.collection} at ${currentUtcTime}`);
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error(`post-collections-refresh-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map