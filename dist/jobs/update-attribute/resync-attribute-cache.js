"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const logger_1 = require("@/common/logger");
const attributes_1 = require("@/models/attributes");
const tokens_1 = require("@/models/tokens");
const QUEUE_NAME = "resync-attribute-cache-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: true,
        removeOnFail: 100,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { contract, tokenId } = job.data;
        const tokenAttributes = await tokens_1.Tokens.getTokenAttributes(contract, tokenId);
        // Recalculate the number of tokens on sale for each attribute
        for (const tokenAttribute of tokenAttributes) {
            const { floorSellValue, onSaleCount } = await tokens_1.Tokens.getSellFloorValueAndOnSaleCount(tokenAttribute.collectionId, tokenAttribute.key, tokenAttribute.value);
            await attributes_1.Attributes.update(tokenAttribute.attributeId, {
                floorSellValue,
                onSaleCount,
                sellUpdatedAt: new Date().toISOString(),
            });
            logger_1.logger.info(QUEUE_NAME, `collection=${tokenAttribute.collectionId}, key=${tokenAttribute.key}, value=${tokenAttribute.value}, floorSellValue=${floorSellValue}, onSaleCount=${onSaleCount}`);
        }
    }, {
        connection: redis_1.redis.duplicate(),
        concurrency: 1,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (contract, tokenId, delay = 60 * 60 * 1000, forceRefresh = false) => {
    const token = `${contract}:${tokenId}`;
    const jobId = forceRefresh ? undefined : token;
    await exports.queue.add(token, { contract, tokenId }, { jobId, delay });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=resync-attribute-cache.js.map