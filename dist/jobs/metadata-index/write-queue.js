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
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const resyncAttributeKeyCounts = __importStar(require("@/jobs/update-attribute/resync-attribute-key-counts"));
const resyncAttributeValueCounts = __importStar(require("@/jobs/update-attribute/resync-attribute-value-counts"));
const rarityQueue = __importStar(require("@/jobs/collection-updates/rarity-queue"));
const fetchCollectionMetadata = __importStar(require("@/jobs/token-updates/fetch-collection-metadata"));
const date_fns_1 = require("date-fns");
const QUEUE_NAME = "metadata-index-write-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const tokenAttributeCounter = {};
        const { collection, contract, tokenId, name, description, imageUrl, mediaUrl, flagged, attributes, } = job.data;
        try {
            const flaggedQueryPart = flagged === undefined
                ? ""
                : `
              is_flagged = $/isFlagged/,
              last_flag_update = now(),
        `;
            // Update the token's metadata.
            const result = await db_1.idb.oneOrNone(`
            UPDATE tokens SET
              name = $/name/,
              description = $/description/,
              image = $/image/,
              media = $/media/,
              ${flaggedQueryPart}
              updated_at = now(),
              collection_id = collection_id,
              created_at = created_at
            WHERE tokens.contract = $/contract/
            AND tokens.token_id = $/tokenId/
            RETURNING collection_id, created_at
          `, {
                contract: (0, utils_1.toBuffer)(contract),
                tokenId,
                name: name || null,
                description: description || null,
                image: imageUrl || null,
                media: mediaUrl || null,
                isFlagged: flagged === undefined ? null : Number(flagged),
            });
            // Skip if there is no associated entry in the `tokens` table
            if (!result) {
                return;
            }
            // If the new collection ID is different from the collection ID currently stored
            if (result.collection_id != collection) {
                logger_1.logger.info("new-collection", `New collection ${collection} for contract=${contract}, tokenId=${tokenId}, old collection=${result.collection_id}`);
                await fetchCollectionMetadata.addToQueue([
                    {
                        contract,
                        tokenId,
                        mintedTimestamp: (0, date_fns_1.getUnixTime)(new Date(result.created_at)),
                        newCollection: true,
                    },
                ], `${contract}-${tokenId}`);
                return;
            }
            const addedTokenAttributes = [];
            const attributeIds = [];
            // Token attributes
            for (const { key, value, kind, rank } of attributes) {
                // Try to update the attribute keys, if number type update range as well and return the ID
                let infoUpdate = "info"; // By default no update to the info
                if (kind == "number") {
                    infoUpdate = `
            CASE WHEN info IS NULL THEN 
                  jsonb_object(array['min_range', 'max_range'], array[$/value/, $/value/]::text[])
                ELSE
                  info || jsonb_object(array['min_range', 'max_range'], array[
                        CASE
                            WHEN (info->>'min_range')::numeric > $/value/::numeric THEN $/value/::numeric
                            ELSE (info->>'min_range')::numeric
                        END,
                        CASE
                            WHEN (info->>'max_range')::numeric < $/value/::numeric THEN $/value/::numeric
                            ELSE (info->>'max_range')::numeric
                        END
                  ]::text[])
            END
            `;
                }
                let attributeKeyResult = await db_1.idb.oneOrNone(`
              UPDATE attribute_keys
              SET info = ${infoUpdate}
              WHERE collection_id = $/collection/
              AND key = $/key/
              RETURNING id
            `, {
                    collection,
                    key: String(key),
                    value,
                });
                if (!(attributeKeyResult === null || attributeKeyResult === void 0 ? void 0 : attributeKeyResult.id)) {
                    let info = null;
                    if (kind == "number") {
                        info = { min_range: Number(value), max_range: Number(value) };
                    }
                    // If no attribute key is available, then save it and refetch
                    attributeKeyResult = await db_1.idb.oneOrNone(`
                INSERT INTO "attribute_keys" (
                  "collection_id",
                  "key",
                  "kind",
                  "rank",
                  "info"
                ) VALUES (
                  $/collection/,
                  $/key/,
                  $/kind/,
                  $/rank/,
                  $/info/
                )
                ON CONFLICT DO NOTHING
                RETURNING "id"
              `, {
                        collection,
                        key: String(key),
                        kind,
                        rank: rank || null,
                        info,
                    });
                }
                if (!(attributeKeyResult === null || attributeKeyResult === void 0 ? void 0 : attributeKeyResult.id)) {
                    // Otherwise, fail (and retry)
                    throw new Error(`Could not fetch/save attribute key "${key}"`);
                }
                // Fetch the attribute from the database (will succeed in the common case)
                let attributeResult = await db_1.redb.oneOrNone(`
              SELECT id
              FROM attributes
              WHERE attribute_key_id = $/attributeKeyId/
              AND value = $/value/
            `, {
                    attributeKeyId: attributeKeyResult.id,
                    value: String(value),
                });
                if (!(attributeResult === null || attributeResult === void 0 ? void 0 : attributeResult.id)) {
                    // If no attribute is not available, then save it and refetch
                    attributeResult = await db_1.idb.oneOrNone(`
                WITH "x" AS (
                  INSERT INTO "attributes" (
                    "attribute_key_id",
                    "value",
                    "sell_updated_at",
                    "buy_updated_at",
                    "collection_id",
                    "kind",
                    "key"
                  ) VALUES (
                    $/attributeKeyId/,
                    $/value/,
                    NOW(),
                    NOW(),
                    $/collection/,
                    $/kind/,
                    $/key/
                  )
                  ON CONFLICT DO NOTHING
                  RETURNING "id"
                )
                
                UPDATE attribute_keys
                SET attribute_count = "attribute_count" + (SELECT COUNT(*) FROM "x")
                WHERE id = $/attributeKeyId/
                RETURNING (SELECT x.id FROM "x"), "attribute_count"
              `, {
                        attributeKeyId: attributeKeyResult.id,
                        value: String(value),
                        collection,
                        kind,
                        key: String(key),
                    });
                }
                if (!(attributeResult === null || attributeResult === void 0 ? void 0 : attributeResult.id)) {
                    // Otherwise, fail (and retry)
                    throw new Error(`Could not fetch/save attribute "${value}"`);
                }
                attributeIds.push(attributeResult.id);
                let sampleImageUpdate = "";
                if (imageUrl) {
                    sampleImageUpdate = `
              UPDATE attributes
              SET sample_images = CASE WHEN (sample_images IS NULL OR array_length(sample_images, 1) < 4) AND array_position(sample_images, $/image/) IS NULL
                      THEN array_prepend($/image/, sample_images)
                   WHEN (array_length(sample_images, 1) >= 4) AND array_position(sample_images, $/image/) IS NULL
                      THEN array_prepend($/image/, array_remove(sample_images, sample_images[4]))
                   ELSE sample_images
              END
              WHERE id = $/attributeId/;`;
                }
                // Associate the attribute with the token
                const tokenAttributeResult = await db_1.idb.oneOrNone(`
              ${sampleImageUpdate}
              INSERT INTO "token_attributes" (
                "contract",
                "token_id",
                "attribute_id",
                "collection_id",
                "key",
                "value"
              ) VALUES (
                $/contract/,
                $/tokenId/,
                $/attributeId/,
                $/collection/,
                $/key/,
                $/value/
              )
              ON CONFLICT DO NOTHING
              RETURNING key, value, attribute_id;
            `, {
                    contract: (0, utils_1.toBuffer)(contract),
                    tokenId,
                    attributeId: attributeResult.id,
                    image: imageUrl || null,
                    collection,
                    key: String(key),
                    value: String(value),
                });
                if (tokenAttributeResult) {
                    addedTokenAttributes.push(tokenAttributeResult);
                    tokenAttributeCounter[attributeResult.id] = 1;
                }
            }
            let attributeIdsFilter = "";
            if (attributeIds.length) {
                attributeIdsFilter = `AND attribute_id NOT IN ($/attributeIds:raw/)`;
            }
            // Clear deleted token attributes
            const removedTokenAttributes = await db_1.idb.manyOrNone(`WITH x AS (
                    DELETE FROM token_attributes
                    WHERE contract = $/contract/
                    AND token_id = $/tokenId/
                    ${attributeIdsFilter}
                    RETURNING contract, token_id, attribute_id, collection_id, key, value, created_at
                   )
                   INSERT INTO removed_token_attributes SELECT * FROM x
                   ON CONFLICT (contract,token_id,attribute_id) DO UPDATE SET deleted_at = now()
                   RETURNING key, value, attribute_id;`, {
                contract: (0, utils_1.toBuffer)(contract),
                tokenId,
                attributeIds: lodash_1.default.join(attributeIds, ","),
            });
            // Schedule attribute refresh
            lodash_1.default.forEach(removedTokenAttributes, (attribute) => {
                tokenAttributeCounter[attribute.attribute_id] = -1;
            });
            logger_1.logger.info(QUEUE_NAME, `Refresh. contract:${contract}, tokenId:${tokenId}, attributeCount:${lodash_1.default.size(attributes)}, addedTokenAttributes:${lodash_1.default.size(addedTokenAttributes)}, removedTokenAttributes:${lodash_1.default.size(removedTokenAttributes)}`);
            const attributesToRefresh = addedTokenAttributes.concat(removedTokenAttributes);
            // Schedule attribute refresh
            lodash_1.default.forEach(attributesToRefresh, (attribute) => {
                resyncAttributeKeyCounts.addToQueue(collection, attribute.key);
                resyncAttributeValueCounts.addToQueue(collection, attribute.key, attribute.value);
            });
            // If any attributes changed
            if (!lodash_1.default.isEmpty(attributesToRefresh)) {
                await rarityQueue.addToQueue(collection); // Recalculate the collection rarity
            }
            // Update the attributes token count
            const replacementParams = {};
            let updateCountsString = "";
            lodash_1.default.forEach(tokenAttributeCounter, (count, attributeId) => {
                replacementParams[`${attributeId}`] = count;
                updateCountsString += `(${attributeId}, $/${attributeId}/),`;
            });
            updateCountsString = lodash_1.default.trimEnd(updateCountsString, ",");
            if (updateCountsString !== "") {
                const updateQuery = `UPDATE attributes
                             SET token_count = token_count + x.countColumn
                             FROM (VALUES ${updateCountsString}) AS x(idColumn, countColumn)
                             WHERE x.idColumn = attributes.id`;
                await db_1.idb.none(updateQuery, replacementParams);
            }
            // Mark the token as having metadata indexed.
            await db_1.idb.none(`
            UPDATE tokens SET metadata_indexed = TRUE, updated_at = now()
            WHERE tokens.contract = $/contract/
              AND tokens.token_id = $/tokenId/
              AND tokens.metadata_indexed IS DISTINCT FROM TRUE
          `, {
                contract: (0, utils_1.toBuffer)(contract),
                tokenId,
            });
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to process token metadata info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 30 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (tokenMetadataInfos) => {
    await exports.queue.addBulk(tokenMetadataInfos
        .map((tokenMetadataInfo) => ({
        name: `${tokenMetadataInfo.contract}-${tokenMetadataInfo.tokenId}`,
        data: tokenMetadataInfo,
    }))
        .filter(({ data }) => data.collection && data.contract && data.tokenId && data.attributes));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=write-queue.js.map