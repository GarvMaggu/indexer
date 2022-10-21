"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const QUEUE_NAME = "token-floor-ask-events-backfill";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 1000,
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
        const { id } = job.data;
        try {
            if (Number(id) > (index_1.config.chainId === 1 ? 43818574 : 116212)) {
                return;
            }
            const results = await db_1.idb.manyOrNone(`
            WITH x AS (
              SELECT
                token_floor_sell_events.id,
                orders.source_id_int,
                orders.valid_between,
                orders.nonce
              FROM token_floor_sell_events
              LEFT JOIN orders
                ON token_floor_sell_events.order_id = orders.id
              WHERE token_floor_sell_events.id > $/id/
              ORDER BY token_floor_sell_events.id
              LIMIT 1000
            )
            UPDATE token_floor_sell_events SET
              source_id_int = x.source_id_int,
              valid_between = x.valid_between,
              nonce = x.nonce
            FROM x
            WHERE token_floor_sell_events.id = x.id
            RETURNING x.id
          `, { id });
            if (results.length) {
                await (0, exports.addToQueue)([{ id: Number(results[results.length - 1].id) }]);
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to handle fill info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 5 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue([{ id: 0 }]);
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (infos) => {
    await exports.queue.addBulk(infos.map((info) => ({
        name: info.id.toString(),
        data: info,
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-token-floor-ask-events.js.map