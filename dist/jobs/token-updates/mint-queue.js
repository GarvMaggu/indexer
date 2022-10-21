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
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
const metadataIndexFetch = __importStar(require("@/jobs/metadata-index/fetch-queue"));
const tokenRefreshCache = __importStar(require("@/jobs/token-updates/token-refresh-cache"));
const fetchCollectionMetadata = __importStar(require("@/jobs/token-updates/fetch-collection-metadata"));
const QUEUE_NAME = "token-updates-mint-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 20000,
        },
        removeOnComplete: 10000,
        removeOnFail: 10000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { contract, tokenId, mintedTimestamp } = job.data;
        try {
            // First, check the database for any matching collection
            const collection = await db_1.idb.oneOrNone(`
            SELECT
              "c"."id",
              "c"."token_set_id",
              "c"."community"
            FROM "collections" "c"
            WHERE "c"."contract" = $/contract/
              AND "c"."token_id_range" @> $/tokenId/::NUMERIC(78, 0)
          `, {
                contract: (0, utils_1.toBuffer)(contract),
                tokenId,
            });
            if (collection) {
                const queries = [];
                // If the collection is readily available in the database then
                // all we needed to do is to associate it with the token
                queries.push({
                    query: `
              WITH "x" AS (
                UPDATE "tokens" AS "t" SET
                  "collection_id" = $/collection/,
                  "updated_at" = now()
                WHERE "t"."contract" = $/contract/
                  AND "t"."token_id" = $/tokenId/
                  AND "t"."collection_id" IS NULL
                RETURNING 1
              )
              UPDATE "collections" SET
                "token_count" = "token_count" + (SELECT COUNT(*) FROM "x"),
                "updated_at" = now()
              WHERE "id" = $/collection/
            `,
                    values: {
                        contract: (0, utils_1.toBuffer)(contract),
                        tokenId,
                        collection: collection.id,
                    },
                });
                // We also need to include the new token to any collection-wide token set
                if (collection.token_set_id) {
                    queries.push({
                        query: `
                WITH "x" AS (
                  SELECT DISTINCT
                    "ts"."id"
                  FROM "token_sets" "ts"
                  WHERE "ts"."id" = $/tokenSetId/
                )
                INSERT INTO "token_sets_tokens" (
                  "token_set_id",
                  "contract",
                  "token_id"
                ) (
                  SELECT
                    "x"."id",
                    $/contract/,
                    $/tokenId/
                  FROM "x"
                ) ON CONFLICT DO NOTHING
              `,
                        values: {
                            contract: (0, utils_1.toBuffer)(contract),
                            tokenId,
                            tokenSetId: collection.token_set_id,
                        },
                    });
                }
                await db_1.idb.none(db_1.pgp.helpers.concat(queries));
                if (!index_1.config.disableRealtimeMetadataRefresh) {
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
            else {
                // We fetch the collection metadata from upstream
                await fetchCollectionMetadata.addToQueue([
                    {
                        contract,
                        tokenId,
                        mintedTimestamp,
                    },
                ]);
            }
            // Set any cached information (eg. floor sell)
            await tokenRefreshCache.addToQueue(contract, tokenId);
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to process mint info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 5 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (mintInfos) => {
    await exports.queue.addBulk(mintInfos.map((mintInfo) => ({
        name: `${mintInfo.contract}-${mintInfo.tokenId}`,
        data: mintInfo,
        opts: {
            // Deterministic job id so that we don't perform duplicated work
            jobId: `${mintInfo.contract}-${mintInfo.tokenId}`,
        },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=mint-queue.js.map