"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const lodash_1 = __importDefault(require("lodash"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const QUEUE_NAME = "backfill-fill-events-wash-trading-score-queue";
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
        const limit = (await redis_1.redis.get(`${QUEUE_NAME}-limit`)) || 1;
        if (!cursor) {
            const cursorJson = await redis_1.redis.get(`${QUEUE_NAME}-next-cursor`);
            if (cursorJson) {
                cursor = JSON.parse(cursorJson);
            }
        }
        if (cursor) {
            continuationFilter = `WHERE (fill_events_2.created_at, fill_events_2.tx_hash, fill_events_2.log_index, fill_events_2.batch_index) > (to_timestamp($/createdAt/), $/txHash/, $/logIndex/, $/batchIndex/)`;
        }
        const results = await db_1.idb.manyOrNone(`
          WITH x AS (  
          SELECT
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index,
            extract(epoch from fill_events_2.created_at) created_at,
            fill_events_2.maker,
            fill_events_2.taker,
            fill_events_2.contract,
            case when o.inverse_count = 0 then 0 else 1 end wash_trading_score
          FROM fill_events_2
          LEFT JOIN LATERAL (
            SELECT count(*) as inverse_count
            FROM fill_events_2 AS fe2
            WHERE fe2.maker = fill_events_2.taker AND fe2.taker = fill_events_2.maker AND fe2.contract = fill_events_2.contract
          ) o ON TRUE
          ${continuationFilter}
          ORDER BY fill_events_2.created_at, fill_events_2.tx_hash, fill_events_2.log_index, fill_events_2.batch_index
          LIMIT $/limit/
          )
          UPDATE fill_events_2 SET
              wash_trading_score = x.wash_trading_score
          FROM x
          WHERE fill_events_2.tx_hash = x.tx_hash
          AND fill_events_2.log_index = x.log_index
          AND fill_events_2.batch_index = x.batch_index
          RETURNING x.created_at, x.tx_hash, x.log_index, x.batch_index
          `, {
            createdAt: cursor === null || cursor === void 0 ? void 0 : cursor.createdAt,
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
                createdAt: lastResult.created_at,
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
//# sourceMappingURL=backfill-fill-events-wash-trading-score.js.map