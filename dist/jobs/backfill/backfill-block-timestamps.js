"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const provider_1 = require("@/common/provider");
const QUEUE_NAME = "backfill-block-timestamps-queue";
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
        const { number } = job.data;
        const limit = 200;
        const results = await db_1.idb.manyOrNone(`
          SELECT
            blocks.number,
            blocks.timestamp
          FROM blocks
          WHERE blocks.number < $/number/
          ORDER BY blocks.number DESC
          LIMIT $/limit/
        `, {
            limit,
            number,
        });
        const values = [];
        const columns = new db_1.pgp.helpers.ColumnSet(["number", "timestamp"], {
            table: "blocks",
        });
        for (const { number, timestamp } of results) {
            if (!timestamp) {
                const block = await provider_1.baseProvider.getBlock(number);
                values.push({ number, timestamp: block.timestamp });
            }
        }
        if (values.length) {
            await db_1.idb.none(`
            UPDATE blocks SET
              timestamp = x.timestamp::INT
            FROM (
              VALUES ${db_1.pgp.helpers.values(values, columns)}
            ) AS x(number, timestamp)
            WHERE blocks.number = x.number
          `);
        }
        if (results.length >= limit) {
            const lastResult = results[results.length - 1];
            await (0, exports.addToQueue)(lastResult.number);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue(await baseProvider.getBlockNumber());
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (number) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { number });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-block-timestamps.js.map