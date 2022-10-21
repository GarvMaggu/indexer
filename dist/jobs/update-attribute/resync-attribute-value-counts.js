"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const logger_1 = require("@/common/logger");
const attributes_1 = require("@/models/attributes");
const tokens_1 = require("@/models/tokens");
const QUEUE_NAME = "resync-attribute-value-counts-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: true,
        removeOnFail: 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { collection, key, value } = job.data;
        const attributeValueCount = await tokens_1.Tokens.getTokenAttributesValueCount(collection, key, value);
        if (!attributeValueCount) {
            const attribute = await attributes_1.Attributes.getAttributeByCollectionKeyValue(collection, key, value);
            if (attribute) {
                await attributes_1.Attributes.delete(attribute.id);
                logger_1.logger.info(QUEUE_NAME, `Deleted from collection=${collection}, key=${key}, value=${value} attributeId=${attribute.id}`);
            }
        }
        else {
            await attributes_1.Attributes.update(attributeValueCount.attributeId, {
                tokenCount: attributeValueCount.count,
            });
            logger_1.logger.info(QUEUE_NAME, `Updated collection=${collection}, key=${key}, value=${value} attributeId=${attributeValueCount.attributeId}, count=${attributeValueCount.count}`);
        }
    }, {
        connection: redis_1.redis.duplicate(),
        concurrency: 3,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (collection, key, value, delay = 60 * 60 * 1000) => {
    const jobId = `${collection}:${key}:${value}`;
    await exports.queue.add(jobId, { collection, key, value }, { jobId, delay });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=resync-attribute-value-counts.js.map