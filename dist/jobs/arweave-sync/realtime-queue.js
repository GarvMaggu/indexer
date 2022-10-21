"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const index_1 = require("@/arweave-sync/index");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const redis_1 = require("@/common/redis");
const index_2 = require("@/config/index");
const QUEUE_NAME = "arweave-sync-realtime";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        // In order to be as lean as possible, leave retrying
        // any failed processes to be done by subsequent jobs
        removeOnComplete: true,
        removeOnFail: true,
        timeout: 120000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_2.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async () => {
        try {
            let localBlock = Number(await redis_1.redis.get(`${QUEUE_NAME}-last-block`));
            if (localBlock === 0) {
                localBlock = (await provider_1.arweaveGateway.blocks.getCurrent()).height;
                await redis_1.redis.set(`${QUEUE_NAME}-last-block`, localBlock);
            }
            else {
                localBlock++;
            }
            let { lastBlock, lastCursor, done } = await (0, index_1.syncArweave)({
                fromBlock: localBlock,
            });
            while (!done) {
                ({ lastBlock, lastCursor, done } = await (0, index_1.syncArweave)({
                    fromBlock: localBlock,
                    afterCursor: lastCursor,
                }));
            }
            if (lastBlock) {
                await redis_1.redis.set(`${QUEUE_NAME}-last-block`, lastBlock);
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Arweave realtime syncing failed: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async () => {
    await exports.queue.add((0, crypto_1.randomUUID)(), {});
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=realtime-queue.js.map