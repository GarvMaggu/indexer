"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = exports.bidUpdateBatchSize = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const utils_1 = require("@/common/utils");
const QUEUE_NAME = "top-bid-update-queue";
exports.bidUpdateBatchSize = 200;
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 100,
        removeOnFail: 100,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { tokenSetId, contract, tokenId } = job.data;
        let continuationFilter = "";
        if (contract && tokenId) {
            continuationFilter = `AND (contract, token_id) > ($/contract/, $/tokenId/)`;
        }
        const query = `
        WITH "z" AS (
          SELECT "x"."contract", "x"."token_id", "y"."order_id", "y"."value", "y"."maker"
          FROM (
            SELECT "tst"."contract", "tst"."token_id"
            FROM "token_sets_tokens" "tst"
            WHERE "token_set_id" = $/tokenSetId/
            ${continuationFilter}
            ORDER BY contract, token_id ASC
            LIMIT ${exports.bidUpdateBatchSize}
          ) "x" LEFT JOIN LATERAL (
            SELECT
              "o"."id" as "order_id",
              "o"."value",
              "o"."maker"
            FROM "orders" "o"
            JOIN "token_sets_tokens" "tst"
              ON "o"."token_set_id" = "tst"."token_set_id"
            WHERE "tst"."contract" = "x"."contract"
              AND "tst"."token_id" = "x"."token_id"
              AND "o"."side" = 'buy'
              AND "o"."fillability_status" = 'fillable'
              AND "o"."approval_status" = 'approved'
              AND EXISTS(
                SELECT FROM "nft_balances" "nb"
                  WHERE "nb"."contract" = "x"."contract"
                  AND "nb"."token_id" = "x"."token_id"
                  AND "nb"."amount" > 0
                  AND "nb"."owner" != "o"."maker"
              )
            ORDER BY "o"."value" DESC
            LIMIT 1
          ) "y" ON TRUE
        ), y AS (
          UPDATE "tokens" AS "t"
          SET "top_buy_id" = "z"."order_id",
              "top_buy_value" = "z"."value",
              "top_buy_maker" = "z"."maker",
              "updated_at" = now()
          FROM "z"
          WHERE "t"."contract" = "z"."contract"
          AND "t"."token_id" = "z"."token_id"
          AND "t"."top_buy_id" IS DISTINCT FROM "z"."order_id"
        )
        
        SELECT contract, token_id
        FROM z
        ORDER BY contract, token_id DESC
        LIMIT 1
      `;
        const result = await db_1.idb.oneOrNone(query, {
            tokenSetId,
            contract: contract ? (0, utils_1.toBuffer)(contract) : "",
            tokenId,
        });
        if (!tokenSetId.startsWith("token:") && result) {
            await (0, exports.addToQueue)(tokenSetId, (0, utils_1.fromBuffer)(result.contract), result.token_id);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 10 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (tokenSetId, contract = null, tokenId = null) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { tokenSetId, contract, tokenId });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=top-bid-update-queue.js.map