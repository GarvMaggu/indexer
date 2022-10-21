"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const crypto_1 = require("crypto");
const bullmq_1 = require("bullmq");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const logger_1 = require("@/common/logger");
const attributes_1 = require("@/models/attributes");
const QUEUE_NAME = "handle-new-buy-order-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 100,
        removeOnFail: 100,
        timeout: 60 * 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { attributeId, topBuyValue } = job.data;
        await attributes_1.Attributes.update(attributeId, {
            topBuyValue,
            buyUpdatedAt: new Date().toISOString(),
        });
        logger_1.logger.info(QUEUE_NAME, `New top bid ${topBuyValue} for attribute id ${attributeId}`);
    }, {
        connection: redis_1.redis.duplicate(),
        concurrency: 3,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (params) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), params);
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=handle-new-buy-order.js.map