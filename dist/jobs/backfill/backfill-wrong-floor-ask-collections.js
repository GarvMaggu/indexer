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
const QUEUE_NAME = "backfill-wrong-floor-ask-collections-queue";
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
    const worker = new bullmq_1.Worker(QUEUE_NAME, async () => {
        const collection = await db_1.idb.oneOrNone(`
        SELECT collections.id FROM collections LEFT JOIN LATERAL (
          SELECT
            tokens.floor_sell_source_id_int,
            tokens.contract AS floor_sell_token_contract,
            tokens.token_id AS floor_sell_token_id,
            tokens.name AS floor_sell_token_name,
            tokens.image AS floor_sell_token_image,
            tokens.floor_sell_id,
            tokens.floor_sell_value,
            tokens.floor_sell_maker,
            tokens.floor_sell_valid_from,
            tokens.floor_sell_valid_to AS floor_sell_valid_until,
            tokens.floor_sell_currency,
            tokens.floor_sell_currency_value
          FROM tokens
          LEFT JOIN orders
            ON tokens.floor_sell_id = orders.id
          WHERE tokens.collection_id = collections.id
          ORDER BY tokens.floor_sell_value
          LIMIT 1
        ) y ON TRUE
        WHERE y.floor_sell_value IS NULL and collections.floor_sell_value IS NOT NULL
        LIMIT 1
          `);
        if (collection) {
            await db_1.idb.none(`
              UPDATE collections SET
                floor_sell_id = x.floor_sell_id,
                floor_sell_value = x.floor_sell_value,
                floor_sell_maker = x.floor_sell_maker,
                floor_sell_source_id_int = x.source_id_int,
                floor_sell_valid_between = x.valid_between,
                updated_at = now()
              FROM (
                WITH collection_floor_sell AS (
                    SELECT
                      tokens.floor_sell_id,
                      tokens.floor_sell_value,
                      tokens.floor_sell_maker,
                      orders.source_id_int,
                      orders.valid_between
                    FROM tokens
                    JOIN orders
                      ON tokens.floor_sell_id = orders.id
                    WHERE tokens.collection_id = $/collection/
                    ORDER BY tokens.floor_sell_value
                    LIMIT 1
                )
                SELECT
                    collection_floor_sell.floor_sell_id,
                    collection_floor_sell.floor_sell_value,
                    collection_floor_sell.floor_sell_maker,
                    collection_floor_sell.source_id_int,
                    collection_floor_sell.valid_between
                FROM collection_floor_sell
                UNION ALL
                SELECT NULL, NULL, NULL, NULL, NULL
                WHERE NOT EXISTS (SELECT 1 FROM collection_floor_sell)
              ) x
              WHERE collections.id = $/collection/
                AND (
                  collections.floor_sell_id IS DISTINCT FROM x.floor_sell_id
                  OR collections.floor_sell_value IS DISTINCT FROM x.floor_sell_value
                )
          `, {
                collection: collection.id,
            });
            await (0, exports.addToQueue)();
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock-v2`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue();
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async () => {
    await exports.queue.add((0, crypto_1.randomUUID)(), {});
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-wrong-floor-ask-collections.js.map