"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const logger_1 = require("@/common/logger");
const tokens_1 = require("@/models/tokens");
const attribute_keys_1 = require("@/models/attribute-keys");
const QUEUE_NAME = "resync-attribute-key-counts-queue";
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
        const { collection, key } = job.data;
        const attributeKeyCount = await tokens_1.Tokens.getTokenAttributesKeyCount(collection, key);
        // If there are no more token for the given key delete it
        if (!attributeKeyCount) {
            await attribute_keys_1.AttributeKeys.delete(collection, key);
            logger_1.logger.info(QUEUE_NAME, `Deleted from collection=${collection}, key=${key}, count=${attributeKeyCount}`);
        }
        else {
            await attribute_keys_1.AttributeKeys.update(collection, key, { attributeCount: attributeKeyCount.count });
            logger_1.logger.info(QUEUE_NAME, `Updated collection=${collection}, key=${key}, count=${attributeKeyCount.count}`);
        }
    }, {
        connection: redis_1.redis.duplicate(),
        concurrency: 3,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (collection, key, delay = 60 * 60 * 1000) => {
    const jobId = `${collection}:${key}`;
    await exports.queue.add(jobId, { collection, key }, { jobId, delay });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=resync-attribute-key-counts.js.map