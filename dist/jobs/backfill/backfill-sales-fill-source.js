"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const p_limit_1 = __importDefault(require("p-limit"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils_2 = require("@/events-sync/utils");
const QUEUE_NAME = "backfill-sales-fill-source";
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
        const { timestamp, txHash, logIndex, batchIndex } = job.data;
        const limit = 300;
        const results = await db_1.idb.manyOrNone(`
          SELECT
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index,
            fill_events_2.timestamp,
            fill_events_2.address,
            fill_events_2.taker,
            fill_events_2.order_kind,
            fill_events_2.order_source_id_int,
            fill_events_2.fill_source_id,
            fill_events_2.aggregator_source_id
          FROM fill_events_2
          WHERE (
            fill_events_2.timestamp,
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index
          ) < (
            $/timestamp/,
            $/txHash/,
            $/logIndex/,
            $/batchIndex/
          )
          ORDER BY
            fill_events_2.timestamp DESC,
            fill_events_2.tx_hash DESC,
            fill_events_2.log_index DESC,
            fill_events_2.batch_index DESC
          LIMIT $/limit/
        `, {
            limit,
            timestamp,
            txHash: (0, utils_1.toBuffer)(txHash),
            logIndex,
            batchIndex,
        });
        const values = [];
        const columns = new db_1.pgp.helpers.ColumnSet(["tx_hash", "log_index", "batch_index", "fill_source_id", "aggregator_source_id", "taker"], {
            table: "fill_events_2",
        });
        const timeBefore = performance.now();
        const plimit = (0, p_limit_1.default)(50);
        await Promise.all(results.map(({ tx_hash, log_index, batch_index, address, order_kind, order_source_id_int, aggregator_source_id, taker, fill_source_id, }) => plimit(async () => {
            if (order_source_id_int && (!fill_source_id || !aggregator_source_id)) {
                const data = await (0, utils_2.extractAttributionData)((0, utils_1.fromBuffer)(tx_hash), order_kind, (0, utils_1.fromBuffer)(address));
                if (data.fillSource || data.aggregatorSource || data.taker) {
                    values.push({
                        tx_hash,
                        log_index,
                        batch_index,
                        fill_source_id: data.fillSource ? data.fillSource.id : fill_source_id,
                        aggregator_source_id: data.aggregatorSource
                            ? data.aggregatorSource.id
                            : aggregator_source_id,
                        taker: data.taker ? (0, utils_1.toBuffer)(data.taker) : taker,
                    });
                }
            }
        })));
        const timeAfter = performance.now();
        logger_1.logger.info(QUEUE_NAME, `Processed ${results.length} results in ${timeAfter - timeBefore} milliseconds`);
        if (values.length) {
            await db_1.idb.none(`
          UPDATE fill_events_2 SET
            fill_source_id = x.fill_source_id::INT,
            aggregator_source_id = x.aggregator_source_id::INT,
            taker = x.taker::BYTEA,
            updated_at = now()
          FROM (
            VALUES ${db_1.pgp.helpers.values(values, columns)}
          ) AS x(tx_hash, log_index, batch_index, fill_source_id, aggregator_source_id, taker)
          WHERE fill_events_2.tx_hash = x.tx_hash::BYTEA
            AND fill_events_2.log_index = x.log_index::INT
            AND fill_events_2.batch_index = x.batch_index::INT
          `);
        }
        if (results.length >= limit) {
            const lastResult = results[results.length - 1];
            await (0, exports.addToQueue)(lastResult.timestamp, (0, utils_1.fromBuffer)(lastResult.tx_hash), lastResult.log_index, lastResult.batch_index);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock-8`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue(
    //       1649801271,
    //       "0xf36edd2401ca4a72c5d474b918caffec50e58e040c8b559eaf1f58e81c821918",
    //       217,
    //       1
    //     );
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (timestamp, txHash, logIndex, batchIndex) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { timestamp, txHash, logIndex, batchIndex }, {
        jobId: `${timestamp}-${txHash}-${logIndex}-${batchIndex}`,
    });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-sales-fill-source.js.map