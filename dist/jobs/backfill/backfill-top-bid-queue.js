"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const QUEUE_NAME = "nft-balance-updates-backfill-top-bid-queue";
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
        const cursor = job.data.cursor;
        const limit = 1;
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `AND token_set_id > '${cursor.tokenSetId}'`;
        }
        const buyOrders = await db_1.idb.manyOrNone(`
              SELECT DISTINCT o.token_set_id
              FROM orders o 
              WHERE o.side = 'buy'
              AND o.fillability_status = 'fillable'
              AND o.approval_status = 'approved'
              ${continuationFilter}
              LIMIT ${limit};
          `);
        if ((buyOrders === null || buyOrders === void 0 ? void 0 : buyOrders.length) > 0) {
            await db_1.idb.none(`
                    WITH z AS (
                        SELECT 
                            x.contract,
                            x.token_id,
                            x.owner,
                            y.id as top_buy_id,
                            y.value as top_buy_value,
                            y.maker as top_buy_maker
                        FROM (
                            SELECT
                                nb.contract,
                                nb.token_id,
                                nb.owner,
                                nb.amount
                            FROM token_sets_tokens tst
                            JOIN nft_balances nb
                              ON tst.contract = nb.contract 
                              AND tst.token_id = nb.token_id 
                            WHERE tst.token_set_id IN ($/tokenSetIds/)
                          ) x
                        LEFT JOIN LATERAL(
                            SELECT
                                o.id,
                                o.value,
                                o.maker
                            FROM orders o 
                            JOIN token_sets_tokens tst
                            ON o.token_set_id = tst.token_set_id
                            WHERE tst.contract = x.contract
                            AND tst.token_id = x.token_id
                            AND o.side = 'buy'
                            AND o.fillability_status = 'fillable'
                            AND o.approval_status = 'approved'
                            AND x.amount > 0
                            AND x.owner != o.maker
                            ORDER BY o.value DESC
                            LIMIT 1
                        ) y ON TRUE
                    )
                    UPDATE nft_balances AS nb
                    SET top_buy_id = z.top_buy_id,
                        top_buy_value = z.top_buy_value,
                        top_buy_maker = z.top_buy_maker
                    FROM z
                    WHERE nb.contract = z.contract
                    AND nb.token_id = z.token_id
                    AND nb.owner = z.owner
                    AND nb.top_buy_id IS DISTINCT FROM z.top_buy_id
          `, {
                tokenSetIds: buyOrders.map((o) => o.token_set_id).join(","),
            });
            if (lodash_1.default.size(buyOrders) == limit) {
                const lastBuyOrder = lodash_1.default.last(buyOrders);
                const nextCursor = {
                    tokenSetId: lastBuyOrder.token_set_id,
                };
                logger_1.logger.info(QUEUE_NAME, `Iterated ${limit} records.  nextCursor=${JSON.stringify(nextCursor)}`);
                await (0, exports.addToQueue)(nextCursor);
            }
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     // await addToQueue();
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (cursor) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { cursor });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-top-bid-queue.js.map