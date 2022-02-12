import { HashZero } from "@ethersproject/constants";
import { Job, Queue, QueueScheduler, Worker } from "bullmq";

import { db } from "@/common/db";
import { logger } from "@/common/logger";
import { redis } from "@/common/redis";
import { config } from "@/config/index";

const QUEUE_NAME = "order-updates-by-id";

export const queue = new Queue(QUEUE_NAME, {
  connection: redis.duplicate(),
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
    removeOnComplete: 10000,
    removeOnFail: 10000,
  },
});
new QueueScheduler(QUEUE_NAME, { connection: redis.duplicate() });

// BACKGROUND WORKER ONLY
if (config.doBackgroundWork) {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { id } = job.data as OrderInfo;

      try {
        // Fetch the order's associated token set
        const data: {
          side: string | null;
          token_set_id: string | null;
        } | null = await db.oneOrNone(
          `
            SELECT
              "o"."side",
              "o"."token_set_id"
            FROM "orders" "o"
            WHERE "o"."id" = $/id/
          `,
          { id }
        );

        if (data && data.side && data.token_set_id) {
          const side = data.side;
          const tokenSetId = data.token_set_id;

          logger.info(
            QUEUE_NAME,
            `Recomputing cached ${side} data given token set ${tokenSetId}`
          );

          // Recompute `top_buy` for token sets that are not single token
          if (side === "buy" && !tokenSetId.startsWith("token")) {
            await db.none(
              `
                WITH "x" AS (
                  SELECT
                    "ts"."id" as "token_set_id",
                    "y".*
                  FROM "token_sets" "ts"
                  LEFT JOIN LATERAL (
                    SELECT
                      "o"."id" as "order_id",
                      "o"."value",
                      "o"."maker",
                      "o"."valid_between"
                    FROM "orders" "o"
                    WHERE "o"."token_set_id" = "ts"."id"
                      AND "o"."side" = 'buy'
                      AND "o"."fillability_status" = 'fillable'
                      AND "o"."approval_status" = 'approved'
                    ORDER BY "o"."value" DESC
                    LIMIT 1
                  ) "y" ON TRUE
                  WHERE "ts"."id" = $/tokenSetId/
                )
                UPDATE "token_sets" AS "ts" SET
                  "top_buy_id" = "x"."order_id",
                  "top_buy_value" = "x"."value",
                  "top_buy_maker" = "x"."maker",
                  "top_buy_valid_between" = "x"."valid_between"
                FROM "x"
                WHERE "ts"."id" = "x"."order_id"
                  AND "ts"."top_buy_id" IS DISTINCT FROM "x"."order_id"
              `,
              { tokenSetId }
            );
          }

          // TODO: Research if splitting the single token updates in multiple
          // batches is needed (eg. to avoid blocking other running queries).

          // Recompute `top_buy` and `floor_sell` for single tokens
          const column = data.side === "sell" ? "floor_sell" : "top_buy";
          await db.none(
            `
              WITH "z" AS (
                SELECT
                  "x"."contract",
                  "x"."token_id",
                  "y"."order_id",
                  "y"."value",
                  "y"."maker",
                  "y"."valid_between"
                FROM (
                  SELECT
                    "tst"."contract",
                    "tst"."token_id"
                  FROM "orders" "o"
                  JOIN "token_sets_tokens" "tst"
                    ON "o"."token_set_id" = "tst"."token_set_id"
                  WHERE "o"."id" = $/id/
                ) "x" LEFT JOIN LATERAL (
                  SELECT
                    "o"."id" as "order_id",
                    "o"."value",
                    "o"."maker",
                    "o"."valid_between"
                  FROM "orders" "o"
                  JOIN "token_sets_tokens" "tst"
                    ON "o"."token_set_id" = "tst"."token_set_id"
                  WHERE "tst"."contract" = "x"."contract"
                    AND "tst"."token_id" = "x"."token_id"
                    AND "o"."side" = '${side}'
                    AND "o"."fillability_status" = 'fillable'
                    AND "o"."approval_status" = 'approved'
                    AND ${
                      side === "sell"
                        ? "true"
                        : `
                            EXISTS(
                              SELECT FROM "nft_balances" "nb"
                                WHERE "nb"."contract" = "x"."contract"
                                AND "nb"."token_id" = "x"."token_id"
                                AND "nb"."amount" > 0
                                AND "nb"."owner" != "o"."maker"
                            )
                          `
                    }
                  ORDER BY "o"."value" ${side === "sell" ? "ASC" : "DESC"}
                  LIMIT 1
                ) "y" ON TRUE
              )
              UPDATE "tokens" AS "t" SET
                "${column}_id" = "z"."order_id",
                "${column}_value" = "z"."value",
                "${column}_maker" = "z"."maker",
                "${column}_valid_between" = "z"."valid_between"
              FROM "z"
              WHERE "t"."contract" = "z"."contract"
                AND "t"."token_id" = "z"."token_id"
                AND "t"."${column}_id" IS DISTINCT FROM "z"."order_id"
            `,
            { id }
          );
        }
      } catch (error) {
        logger.error(
          QUEUE_NAME,
          `Failed to handle order info ${JSON.stringify(job.data)}: ${error}`
        );
        throw error;
      }
    },
    { connection: redis.duplicate(), concurrency: 3 }
  );
  worker.on("error", (error) => {
    logger.error(QUEUE_NAME, `Worker errored: ${error}`);
  });
}

export type OrderInfo = {
  // Deterministic context that triggered the jobs
  context: string;
  id: string;
};

export const addToQueue = async (orderInfos: OrderInfo[]) => {
  // Ignore empty orders
  orderInfos = orderInfos.filter(({ id }) => id !== HashZero);

  await queue.addBulk(
    orderInfos.map((orderInfo) => ({
      name: orderInfo.id,
      data: orderInfo,
      opts: {
        // We should make sure not to perform any expensive work more
        // than once. As such, we keep the last performed jobs in the
        // queue and give all jobs a deterministic id so that we skip
        // handling jobs that already got executed.
        jobId: orderInfo.context,
      },
    }))
  );
};