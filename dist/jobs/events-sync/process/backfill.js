"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const handlers_1 = require("@/events-sync/handlers");
const QUEUE_NAME = "events-sync-process-backfill";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 10000,
        },
        removeOnComplete: 100,
        removeOnFail: 10000,
        timeout: 120000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const info = job.data;
        try {
            await (0, handlers_1.processEvents)(info);
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Events processing failed: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 20 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (infos) => {
    await exports.queue.addBulk(infos.map((info) => ({ name: (0, crypto_1.randomUUID)(), data: info })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill.js.map