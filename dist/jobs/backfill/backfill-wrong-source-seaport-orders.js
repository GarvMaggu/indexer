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
const sources_1 = require("@/models/sources");
const QUEUE_NAME = "backfill-wrong-source-seaport-orders";
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
        const { orderId } = job.data;
        const limit = 1000;
        // There was a period of time when we didn't properly set the source for OpenSea orders
        const results = await db_1.idb.manyOrNone(`
          SELECT
            orders.id,
            orders.source_id_int
          FROM orders
          WHERE orders.id < $/orderId/
            AND orders.created_at > to_timestamp(1660000000)
            AND orders.created_at < to_timestamp(1661000000)
            AND orders.kind = 'seaport'
            AND orders.source_id_int IS NULL
            AND orders.contract IS NOT NULL
          ORDER BY orders.id DESC
          LIMIT $/limit/
        `, {
            limit,
            orderId,
        });
        const sources = await sources_1.Sources.getInstance();
        const values = [];
        const columns = new db_1.pgp.helpers.ColumnSet(["id", "source_id_int"], {
            table: "orders",
        });
        for (const { id, source_id_int } of results) {
            if (!source_id_int) {
                values.push({
                    id,
                    source_id_int: sources.getByDomain("opensea.io").id,
                });
            }
        }
        if (values.length) {
            await db_1.idb.none(`
            UPDATE orders SET
              source_id_int = x.source_id_int::INT,
              updated_at = now()
            FROM (
              VALUES ${db_1.pgp.helpers.values(values, columns)}
            ) AS x(id, source_id_int)
            WHERE orders.id = x.id::TEXT
          `);
        }
        if (results.length >= limit) {
            const lastResult = results[results.length - 1];
            await (0, exports.addToQueue)(lastResult.id);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // if (config.chainId === 1) {
    //   redlock
    //     .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //     .then(async () => {
    //       await addToQueue("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    //     })
    //     .catch(() => {
    //       // Skip on any errors
    //     });
    // }
}
const addToQueue = async (orderId) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { orderId });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-wrong-source-seaport-orders.js.map