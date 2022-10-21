"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const collections_1 = require("@/models/collections");
const QUEUE_NAME = "collection-recalc-floor-ask-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 20000,
        },
        removeOnComplete: true,
        removeOnFail: 10000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { collection } = job.data;
        await collections_1.Collections.recalculateCollectionFloorSell(collection);
    }, { connection: redis_1.redis.duplicate(), concurrency: 10 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (collection, delay = 60 * 5 * 1000) => {
    await exports.queue.add(collection, { collection }, { delay, jobId: collection });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=recalc-floor-queue.js.map