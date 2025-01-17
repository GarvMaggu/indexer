"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const QUEUE_NAME = "backfill-fill-events-updated-at-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 10000,
        removeOnFail: 10000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        let cursor = job.data.cursor;
        let continuationFilter = "";
        const limit = (await redis_1.redis.get(`${QUEUE_NAME}-limit`)) || 500;
        if (!cursor) {
            const cursorJson = await redis_1.redis.get(`${QUEUE_NAME}-next-cursor`);
            if (cursorJson) {
                cursor = JSON.parse(cursorJson);
            }
        }
        if (cursor) {
            continuationFilter = `WHERE (fill_events_2.created_at, fill_events_2.tx_hash, fill_events_2.log_index, fill_events_2.batch_index) > (to_timestamp($/createdTs/), $/txHash/, $/logIndex/, $/batchIndex/)`;
        }
        const results = await db_1.idb.manyOrNone(`
          WITH x AS (  
          SELECT
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index,
            fill_events_2.created_at,
            extract(epoch from fill_events_2.created_at) created_ts
          FROM fill_events_2
          ${continuationFilter}
          ORDER BY fill_events_2.created_at, fill_events_2.tx_hash, fill_events_2.log_index, fill_events_2.batch_index
          LIMIT $/limit/
          )
          UPDATE fill_events_2 SET
              updated_at = x.created_at
          FROM x
          WHERE fill_events_2.tx_hash = x.tx_hash
          AND fill_events_2.log_index = x.log_index
          AND fill_events_2.batch_index = x.batch_index
          RETURNING x.created_ts, x.tx_hash, x.log_index, x.batch_index
          `, {
            createdTs: cursor === null || cursor === void 0 ? void 0 : cursor.createdTs,
            txHash: (cursor === null || cursor === void 0 ? void 0 : cursor.txHash) ? (0, utils_1.toBuffer)(cursor.txHash) : null,
            logIndex: cursor === null || cursor === void 0 ? void 0 : cursor.logIndex,
            batchIndex: cursor === null || cursor === void 0 ? void 0 : cursor.batchIndex,
            limit,
        });
        if (results.length == limit) {
            const lastResult = lodash_1.default.last(results);
            const nextCursor = {
                txHash: (0, utils_1.fromBuffer)(lastResult.tx_hash),
                logIndex: lastResult.log_index,
                batchIndex: lastResult.batch_index,
                createdTs: lastResult.created_ts,
            };
            await redis_1.redis.set(`${QUEUE_NAME}-next-cursor`, JSON.stringify(nextCursor));
            await (0, exports.addToQueue)(nextCursor);
        }
        logger_1.logger.info(QUEUE_NAME, `Processed ${results.length} fill events.  limit=${limit}, cursor=${JSON.stringify(cursor)}`);
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue();
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (cursor) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { cursor }, { delay: 1000 });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-fill-events-updated-at.js.map