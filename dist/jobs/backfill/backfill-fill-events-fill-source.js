"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils_2 = require("@/events-sync/utils");
const QUEUE_NAME = "backfill-fill-events-fill-source-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 20000,
        },
        removeOnComplete: 10000,
        removeOnFail: 10000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        var _a, _b;
        const { timestamp, logIndex, batchIndex } = job.data;
        const limit = 500;
        const result = await db_1.idb.manyOrNone(`
          SELECT
            fill_events_2.order_kind,
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index,
            fill_events_2.taker,
            fill_events_2.aggregator_source_id,
            fill_events_2.fill_source_id,
            fill_events_2.timestamp
          FROM fill_events_2
          WHERE (fill_events_2.timestamp, fill_events_2.log_index, fill_events_2.batch_index) < ($/timestamp/, $/logIndex/, $/batchIndex/)
          ORDER BY
            fill_events_2.timestamp DESC,
            fill_events_2.log_index DESC,
            fill_events_2.batch_index DESC
          LIMIT $/limit/
        `, { limit, timestamp, logIndex, batchIndex });
        const values = [];
        const columns = new db_1.pgp.helpers.ColumnSet(["tx_hash", "log_index", "batch_index", "taker", "fill_source_id", "aggregator_source_id"], {
            table: "fill_events_2",
        });
        for (const { tx_hash, log_index, batch_index, order_kind, taker, fill_source_id, aggregator_source_id, } of result) {
            if (!fill_source_id || !aggregator_source_id) {
                const txHash = (0, utils_1.fromBuffer)(tx_hash);
                const data = await (0, utils_2.extractAttributionData)(txHash, order_kind);
                let realTaker = taker;
                if (data.taker) {
                    realTaker = taker;
                }
                values.push({
                    tx_hash,
                    log_index,
                    batch_index,
                    taker: realTaker,
                    fill_source_id: (_a = data.fillSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregator_source_id: (_b = data.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                });
            }
        }
        if (values.length) {
            await db_1.idb.none(`
            UPDATE fill_events_2 SET
              aggregator_source_id = x.aggregator_source_id::INT,
              fill_source_id = x.fill_source_id::INT,
              taker = x.taker::BYTEA
            FROM (
              VALUES ${db_1.pgp.helpers.values(values, columns)}
            ) AS x(tx_hash, log_index, batch_index, taker, fill_source_id, aggregator_source_id)
            WHERE fill_events_2.tx_hash = x.tx_hash::BYTEA
              AND fill_events_2.log_index = x.log_index::INT
              AND fill_events_2.batch_index = x.batch_index::INT
          `);
        }
        if (result.length >= limit) {
            const lastResult = result[result.length - 1];
            await (0, exports.addToQueue)(lastResult.timestamp, lastResult.log_index, lastResult.batch_index);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock-10`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue(now(), 0, 0);
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (timestamp, logIndex, batchIndex) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { timestamp, logIndex, batchIndex });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-fill-events-fill-source.js.map