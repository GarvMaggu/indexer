"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const tokens_1 = require("@/models/tokens");
const QUEUE_NAME = "token-refresh-cache";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 100,
        removeOnFail: 100,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { contract, tokenId } = job.data;
        // Refresh the token floor sell and top bid
        await tokens_1.Tokens.recalculateTokenFloorSell(contract, tokenId);
        await tokens_1.Tokens.recalculateTokenTopBid(contract, tokenId);
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (contract, tokenId) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { contract, tokenId });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=token-refresh-cache.js.map