"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const QUEUE_NAME = "collection-updates-top-bid-queue";
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
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { kind, collectionId, txHash, txTimestamp } = job.data;
        try {
            await db_1.idb.none(`
            WITH y AS (
              UPDATE collections SET
                top_buy_id = x.top_buy_id,
                top_buy_value = x.top_buy_value,
                top_buy_maker = x.top_buy_maker,
                top_buy_source_id_int = x.source_id_int,
                top_buy_valid_between = x.valid_between,
                updated_at = now()
              FROM (
                  SELECT
                    collections.id AS collection_id,
                    y.*
                  FROM collections
                  LEFT JOIN LATERAL (
                  SELECT
                    token_sets.top_buy_id,
                    token_sets.top_buy_value,
                    token_sets.top_buy_maker,
                    orders.source_id_int,
                    orders.valid_between
                  FROM token_sets
                  JOIN orders
                    ON token_sets.top_buy_id = orders.id
                  WHERE token_sets.collection_id = collections.id\t                
                  ORDER BY token_sets.top_buy_value DESC
                  LIMIT 1
                  ) y ON TRUE
                  WHERE collections.id = $/collectionId/   
              ) x
              WHERE collections.id = $/collectionId/
                AND (
                  collections.top_buy_id IS DISTINCT FROM x.top_buy_id
                  OR collections.top_buy_value IS DISTINCT FROM x.top_buy_value
                )
              RETURNING
                collections.top_buy_id,
                collections.top_buy_value,
                (
                  SELECT
                    collections.top_buy_value
                  FROM collections
                  WHERE id = $/collectionId/
                ) AS old_top_buy_value,
                collections.top_buy_maker,
                collections.top_buy_source_id_int,
                collections.top_buy_valid_between
            )
            INSERT INTO collection_top_bid_events(
              kind,
              collection_id,
              contract,
              token_set_id,
              order_id,
              order_source_id_int,
              order_valid_between,
              maker,
              price,
              previous_price,
              tx_hash,
              tx_timestamp
            )
            SELECT
              $/kind/::token_floor_sell_event_kind_t,
              $/collectionId/,
              z.contract,
              z.token_set_id,
              y.top_buy_id,
              y.top_buy_source_id_int,
              y.top_buy_valid_between,
              y.top_buy_maker,
              y.top_buy_value,
              y.old_top_buy_value,
              $/txHash/,
              $/txTimestamp/
            FROM y
            JOIN LATERAL (
              SELECT
                orders.contract,
                orders.token_set_id
              FROM orders
              WHERE orders.id = y.top_buy_id
              LIMIT 1
            ) z ON TRUE
          `, {
                kind,
                collectionId,
                txHash: txHash ? (0, utils_1.toBuffer)(txHash) : null,
                txTimestamp,
            });
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to process collection top-bid info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 10 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (topBidInfos) => {
    await exports.queue.addBulk(topBidInfos.map((topBidInfos) => ({
        name: `${topBidInfos.collectionId}`,
        data: topBidInfos,
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=top-bid-queue.js.map