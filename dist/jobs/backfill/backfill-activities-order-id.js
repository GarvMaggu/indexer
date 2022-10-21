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
const index_1 = require("@/config/index");
const QUEUE_NAME = "backfill-activities-order-id";
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
            continuationFilter = `WHERE (a.id) > ($/activityId/)`;
        }
        const results = await db_1.idb.manyOrNone(`
              UPDATE activities SET
                order_id = x.orderId
              FROM (
                SELECT a.id as activityId, a.metadata->>'orderId' as orderId
                FROM activities a
                ${continuationFilter}
                ORDER BY a.id
                LIMIT $/limit/
              ) x
              WHERE activities.id = x.activityId
              RETURNING activities.id
          `, {
            activityId: cursor === null || cursor === void 0 ? void 0 : cursor.activityId,
            limit,
        });
        let nextCursor;
        if (results.length == limit) {
            const lastResult = lodash_1.default.last(results);
            nextCursor = {
                activityId: lastResult.id,
            };
            await redis_1.redis.set(`${QUEUE_NAME}-next-cursor`, JSON.stringify(nextCursor));
            await (0, exports.addToQueue)(nextCursor);
        }
        logger_1.logger.info(QUEUE_NAME, `Processed ${results.length} activities.  limit=${limit}, cursor=${JSON.stringify(cursor)}, nextCursor=${JSON.stringify(nextCursor)}`);
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
//# sourceMappingURL=backfill-activities-order-id.js.map