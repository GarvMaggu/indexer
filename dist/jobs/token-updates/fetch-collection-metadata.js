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
const network_1 = require("@/config/network");
const metadataIndexFetch = __importStar(require("@/jobs/metadata-index/fetch-queue"));
const metadata_api_1 = __importDefault(require("@/utils/metadata-api"));
const collectionRecalcFloorAsk = __importStar(require("@/jobs/collection-updates/recalc-floor-queue"));
const QUEUE_NAME = "token-updates-fetch-collection-metadata-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 20000,
        },
        removeOnComplete: 10,
        removeOnFail: 10000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { contract, tokenId, mintedTimestamp, newCollection } = job.data;
        try {
            const collection = await metadata_api_1.default.getCollectionMetadata(contract, tokenId, {
                allowFallback: true,
            });
            let tokenIdRange = null;
            if (collection.tokenIdRange) {
                tokenIdRange = `numrange(${collection.tokenIdRange[0]}, ${collection.tokenIdRange[1]}, '[]')`;
            }
            else if (collection.id === contract) {
                tokenIdRange = `'(,)'::numrange`;
            }
            const tokenIdRangeParam = tokenIdRange ? "$/tokenIdRange:raw/" : "$/tokenIdRange/";
            const queries = [];
            queries.push({
                query: `
              INSERT INTO "collections" (
                "id",
                "slug",
                "name",
                "community",
                "metadata",
                "royalties",
                "contract",
                "token_id_range",
                "token_set_id",
                "minted_timestamp"
              ) VALUES (
                $/id/,
                $/slug/,
                $/name/,
                $/community/,
                $/metadata:json/,
                $/royalties:json/,
                $/contract/,
                ${tokenIdRangeParam},
                $/tokenSetId/,
                $/mintedTimestamp/
              ) ON CONFLICT DO NOTHING;
            `,
                values: {
                    id: collection.id,
                    slug: collection.slug,
                    name: collection.name,
                    community: collection.community,
                    metadata: collection.metadata,
                    royalties: collection.royalties,
                    contract: (0, utils_1.toBuffer)(collection.contract),
                    tokenIdRange,
                    tokenSetId: collection.tokenSetId,
                    mintedTimestamp,
                },
            });
            // Since this is the first time we run into this collection,
            // we update all tokens that match its token definition
            let tokenFilter = `AND "token_id" <@ ${tokenIdRangeParam}`;
            if (lodash_1.default.isNull(tokenIdRange)) {
                tokenFilter = `AND "token_id" = $/tokenId/`;
            }
            queries.push({
                query: `
              WITH "x" AS (
                UPDATE "tokens" SET 
                  "collection_id" = $/collection/,
                  "updated_at" = now()
                WHERE "contract" = $/contract/
                ${tokenFilter}
                RETURNING 1
              )
              UPDATE "collections" SET
                "token_count" = (SELECT COUNT(*) FROM "x"),
                "updated_at" = now()
              WHERE "id" = $/collection/
            `,
                values: {
                    contract: (0, utils_1.toBuffer)(collection.contract),
                    tokenIdRange,
                    tokenId,
                    collection: collection.id,
                },
            });
            await db_1.idb.none(db_1.pgp.helpers.concat(queries));
            // id this is a new collection recalculate the collection floor price
            if ((collection === null || collection === void 0 ? void 0 : collection.id) && newCollection) {
                await collectionRecalcFloorAsk.addToQueue(collection.id);
            }
            if ((collection === null || collection === void 0 ? void 0 : collection.id) && !index_1.config.disableRealtimeMetadataRefresh) {
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
                ], true, (0, network_1.getNetworkSettings)().metadataMintDelay);
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to fetch collection metadata ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 5 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (infos, jobId = "") => {
    await exports.queue.addBulk(infos.map((info) => {
        if (jobId === "") {
            // For contracts with multiple collections, we have to include the token in order the fetch the right collection
            jobId = (0, network_1.getNetworkSettings)().multiCollectionContracts.includes(info.contract)
                ? `${info.contract}-${info.tokenId}`
                : info.contract;
        }
        return {
            name: jobId,
            data: info,
            opts: {
                // Deterministic job id so that we don't perform duplicated work
                jobId: jobId,
            },
        };
    }));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=fetch-collection-metadata.js.map