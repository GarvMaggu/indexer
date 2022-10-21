"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const index_1 = require("@/api/index");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_2 = require("@/config/index");
// Periodically check cache values against the underlying
// data backing those caches in order to ensure there are
// no inconsistencies between them. Some examples of what
// we might want to check:
// - tokens cached `top_buy` and `floor_sell`
// - token sets cached `top_buy`
// BACKGROUND WORKER ONLY
if (index_2.config.doBackgroundWork) {
    node_cron_1.default.schedule("*/5 * * * *", async () => await redis_1.redlock.acquire(["cache-check-lock"], (5 * 60 - 5) * 1000).then(async () => {
        logger_1.logger.info("cache-check", "Checking cache consistency");
        try {
            // Randomly check the tokens `floor_sell` caches
            {
                const results = await db_1.redb.manyOrNone(`
                  SELECT * FROM (
                    SELECT
                      "c"."id",
                      "c"."contract"
                    FROM "collections" "c"
                    TABLESAMPLE system_rows(5)
                  ) "x"
                  LEFT JOIN LATERAL (
                    WITH "w" AS (
                      SELECT
                        "t"."contract",
                        "t"."token_id",
                        "t"."floor_sell_value",
                        "y"."value"
                      FROM "tokens" "t"
                      LEFT JOIN LATERAL (
                        SELECT "o"."value" FROM "orders" "o"
                        JOIN "token_sets_tokens" "tst"
                          ON "o"."token_set_id" = "tst"."token_set_id"
                        WHERE "tst"."contract" = "t"."contract"
                          AND "tst"."token_id" = "t"."token_id"
                          AND "o"."side" = 'sell'
                          AND "o"."fillability_status" = 'fillable'
                          AND "o"."approval_status" = 'approved'
                        ORDER BY "o"."value"
                        LIMIT 1
                      ) "y" ON TRUE
                      WHERE "t"."collection_id" = "x"."id"
                      ORDER BY "t"."floor_sell_value"
                      LIMIT 5
                    )
                    SELECT EXISTS(
                      SELECT FROM "w" WHERE "w"."floor_sell_value" != "w"."value"
                    ) AS "is_wrong"
                  ) "z" ON TRUE
                `);
                for (const { id, contract, is_wrong } of results) {
                    if (is_wrong) {
                        logger_1.logger.error("cache-check", `Detected wrong tokens "floor_sell" cache for collection ${id}`);
                        // Automatically trigger a fix for the wrong cache
                        await (0, index_1.inject)({
                            method: "POST",
                            url: "/admin/fix-cache",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Admin-Api-Key": index_2.config.adminApiKey,
                            },
                            payload: {
                                kind: "tokens-floor-sell",
                                contracts: [(0, utils_1.fromBuffer)(contract)],
                            },
                        });
                    }
                }
            }
            // Randomly check the tokens `top_buy` caches
            {
                const results = await db_1.redb.manyOrNone(`
                  SELECT * FROM (
                    SELECT
                      "c"."id",
                      "c"."contract"
                    FROM "collections" "c"
                    TABLESAMPLE system_rows(5)
                  ) "x"
                  LEFT JOIN LATERAL (
                    WITH "w" AS (
                      SELECT
                        "t"."contract",
                        "t"."token_id",
                        "t"."top_buy_value",
                        "y"."value"
                      FROM "tokens" "t"
                      LEFT JOIN LATERAL (
                        SELECT "o"."value" FROM "orders" "o"
                        JOIN "token_sets_tokens" "tst"
                          ON "o"."token_set_id" = "tst"."token_set_id"
                        WHERE "tst"."contract" = "t"."contract"
                          AND "tst"."token_id" = "t"."token_id"
                          AND "o"."side" = 'buy'
                          AND "o"."fillability_status" = 'fillable'
                          AND "o"."approval_status" = 'approved'
                          AND EXISTS(
                            SELECT FROM "nft_balances" "nb"
                            WHERE "nb"."contract" = "t"."contract"
                              AND "nb"."token_id" = "t"."token_id"
                              AND "nb"."amount" > 0
                              AND "nb"."owner" != "o"."maker"
                          )
                        ORDER BY "o"."value" DESC
                        LIMIT 1
                      ) "y" ON TRUE
                      WHERE "t"."collection_id" = "x"."id"
                      ORDER BY "t"."top_buy_value" desc
                      LIMIT 5
                    )
                    SELECT EXISTS(
                      SELECT FROM "w" WHERE "w"."top_buy_value" != "w"."value"
                    ) AS "is_wrong"
                  ) "z" ON TRUE
                `);
                for (const { id, contract, is_wrong } of results) {
                    if (is_wrong) {
                        logger_1.logger.error("cache-check", `Detected wrong tokens "top_buy" cache for collection ${id}`);
                        // Automatically trigger a fix for the wrong cache
                        await (0, index_1.inject)({
                            method: "POST",
                            url: "/admin/fix-cache",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Admin-Api-Key": index_2.config.adminApiKey,
                            },
                            payload: {
                                kind: "tokens-top-buy",
                                contracts: [(0, utils_1.fromBuffer)(contract)],
                            },
                        });
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error("cache-check", `Failed to check cache consistency: ${error}`);
        }
    }));
}
//# sourceMappingURL=index.js.map