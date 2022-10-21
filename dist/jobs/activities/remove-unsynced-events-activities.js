"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const activities_1 = require("@/models/activities");
const user_activities_1 = require("@/models/user-activities");
const QUEUE_NAME = "remove-unsynced-events-activities-queue";
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
        const { blockHash } = job.data;
        await Promise.all([
            activities_1.Activities.deleteByBlockHash(blockHash),
            user_activities_1.UserActivities.deleteByBlockHash(blockHash),
        ]);
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (blockHash) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { blockHash });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=remove-unsynced-events-activities.js.map