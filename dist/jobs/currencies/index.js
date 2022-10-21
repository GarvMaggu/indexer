"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const currencies_1 = require("@/utils/currencies");
const QUEUE_NAME = "currencies-fetch";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 20,
        backoff: {
            type: "exponential",
            delay: 10000,
        },
        removeOnComplete: 10000,
        removeOnFail: 10000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { currency } = job.data;
        const details = await (0, currencies_1.tryGetCurrencyDetails)(currency);
        await db_1.idb.none(`
          UPDATE currencies SET
            name = $/name/,
            symbol = $/symbol/,
            decimals = $/decimals/,
            metadata = $/metadata:json/
          WHERE contract = $/contract/
        `, {
            contract: (0, utils_1.toBuffer)(currency),
            ...details,
        });
    }, { connection: redis_1.redis.duplicate(), concurrency: 10 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (data) => {
    await exports.queue.add(data.currency, data, { jobId: data.currency });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=index.js.map