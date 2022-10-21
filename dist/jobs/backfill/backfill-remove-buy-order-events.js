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
const QUEUE_NAME = "remove-buy-order-events-queue";
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
        const cursor = job.data.cursor;
        const limit = 1;
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `AND (created_at, id) < (to_timestamp($/createdAt/), $/id/)`;
        }
        const buyOrders = await db_1.redb.manyOrNone(`
              SELECT extract(epoch from created_at) created_at, id
              FROM orders
              WHERE side = 'buy'
              ${continuationFilter}
              ORDER BY created_at DESC,id DESC
              LIMIT $/limit/;
          `, {
            createdAt: cursor === null || cursor === void 0 ? void 0 : cursor.createdAt,
            id: cursor === null || cursor === void 0 ? void 0 : cursor.id,
            limit,
        });
        if ((buyOrders === null || buyOrders === void 0 ? void 0 : buyOrders.length) > 0) {
            await db_1.idb.none(`
            DELETE from order_events
            WHERE order_events.order_id IN ($/orderIds/)
          `, {
                orderIds: buyOrders.map((o) => o.id).join(","),
            });
            if (lodash_1.default.size(buyOrders) == limit) {
                const lastBuyOrder = lodash_1.default.last(buyOrders);
                const nextCursor = {
                    id: lastBuyOrder.id,
                    createdAt: lastBuyOrder.created_at,
                };
                logger_1.logger.info(QUEUE_NAME, `Iterated ${limit} records.  nextCursor=${JSON.stringify(nextCursor)}`);
                await (0, exports.addToQueue)(nextCursor);
            }
        }
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
    await exports.queue.add((0, crypto_1.randomUUID)(), { cursor });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-remove-buy-order-events.js.map