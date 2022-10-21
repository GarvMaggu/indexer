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
const tokens_1 = require("@/models/tokens");
const QUEUE_NAME = "fix-activities-missing-collection-queue";
const MAX_RETRIES = 5;
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: true,
        removeOnFail: 10000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { contract, tokenId, retry } = job.data;
        const token = await tokens_1.Tokens.getByContractAndTokenId(contract, tokenId, true);
        job.data.addToQueue = false;
        if (token === null || token === void 0 ? void 0 : token.collectionId) {
            // Update the collection id of any missing activities
            await Promise.all([
                activities_1.Activities.updateMissingCollectionId(contract, tokenId, token.collectionId),
                user_activities_1.UserActivities.updateMissingCollectionId(contract, tokenId, token.collectionId),
            ]);
        }
        else if (retry < MAX_RETRIES) {
            job.data.addToQueue = true;
        }
        else {
            logger_1.logger.warn(QUEUE_NAME, `Max retries reached for ${JSON.stringify(job.data)}`);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 15 });
    worker.on("completed", async (job) => {
        if (job.data.addToQueue) {
            const retry = job.data.retry + 1;
            await (0, exports.addToQueue)(job.data.contract, job.data.tokenId, retry);
        }
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (contract, tokenId, retry = 0) => {
    const jobId = `${contract}:${tokenId}`;
    const delay = retry ? retry ** 2 * 300 * 1000 : 0;
    await exports.queue.add((0, crypto_1.randomUUID)(), {
        contract,
        tokenId,
        retry,
    }, {
        jobId,
        delay,
    });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=fix-activities-missing-collection.js.map