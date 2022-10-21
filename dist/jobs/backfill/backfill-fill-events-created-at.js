"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const QUEUE_NAME = "backfill-fill-events-created-at-queue";
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
    const worker = new bullmq_1.Worker(QUEUE_NAME, async () => {
        const limit = 200;
        const { rowCount } = await db_1.idb.result(`
            WITH x AS (
                SELECT "timestamp", log_index, batch_index 
                FROM fill_events_2
                WHERE created_at IS NULL
                LIMIT $/limit/
            )
            UPDATE fill_events_2 SET
              created_at = to_timestamp(x."timestamp")
            FROM x
            WHERE fill_events_2."timestamp" = x."timestamp"
            AND fill_events_2.log_index = x.log_index
            AND fill_events_2.batch_index = x.batch_index
          `, {
            limit,
        });
        logger_1.logger.info(QUEUE_NAME, `Updated ${rowCount} records`);
        if (rowCount > 0) {
            logger_1.logger.info(QUEUE_NAME, `Triggering next job.`);
            await (0, exports.addToQueue)();
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
const addToQueue = async () => {
    await exports.queue.add((0, crypto_1.randomUUID)(), {}, { delay: 1000 });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-fill-events-created-at.js.map