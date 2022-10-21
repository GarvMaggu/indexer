"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const QUEUE_NAME = "events-sync-ft-transfers-write";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 10000,
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
        const { query } = job.data;
        try {
            await db_1.idb.none(query);
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed flushing ft transfer events to the database: ${error}`);
            throw error;
        }
    }, {
        connection: redis_1.redis.duplicate(),
        // It's very important to have this queue be single-threaded
        // in order to avoid database write deadlocks (and it can be
        // even better to have it be single-process).
        concurrency: 1,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (query) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { query });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=ft-transfers.js.map