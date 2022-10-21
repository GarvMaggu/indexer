"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addEventsOnChain = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const addEventsOnChain = async (events) => {
    const fillValues = [];
    for (const event of events) {
        fillValues.push({
            address: (0, utils_1.toBuffer)(event.baseEventParams.address),
            block: event.baseEventParams.block,
            block_hash: (0, utils_1.toBuffer)(event.baseEventParams.blockHash),
            tx_hash: (0, utils_1.toBuffer)(event.baseEventParams.txHash),
            tx_index: event.baseEventParams.txIndex,
            log_index: event.baseEventParams.logIndex,
            timestamp: event.baseEventParams.timestamp,
            batch_index: event.baseEventParams.batchIndex,
            order_kind: event.orderKind,
            order_id: event.orderId || null,
            order_side: event.orderSide,
            order_source_id_int: event.orderSourceId || null,
            maker: (0, utils_1.toBuffer)(event.maker),
            taker: (0, utils_1.toBuffer)(event.taker),
            price: event.price,
            contract: (0, utils_1.toBuffer)(event.contract),
            token_id: event.tokenId,
            amount: event.amount,
            aggregator_source_id: event.aggregatorSourceId || null,
            fill_source_id: event.fillSourceId || null,
            wash_trading_score: event.washTradingScore || 0,
            currency: (0, utils_1.toBuffer)(event.currency),
            currency_price: event.currencyPrice || null,
            usd_price: event.usdPrice || null,
            is_primary: event.isPrimary || null,
        });
    }
    const queries = [];
    if (fillValues.length) {
        const columns = new db_1.pgp.helpers.ColumnSet([
            "address",
            "block",
            "block_hash",
            "tx_hash",
            "tx_index",
            "log_index",
            "timestamp",
            "batch_index",
            "order_kind",
            "order_id",
            "order_side",
            "order_source_id_int",
            "maker",
            "taker",
            "price",
            "contract",
            "token_id",
            "amount",
            "aggregator_source_id",
            "fill_source_id",
            "wash_trading_score",
            "currency",
            "currency_price",
            "usd_price",
            "is_primary",
        ], { table: "fill_events_2" });
        // Atomically insert the fill events and update order statuses
        // NOTE: Ideally we have an `ON CONFLICT NO NOTHING` clause, but
        // in order to be able to sync sales/cancels before orders we do
        // a redundant update (so that the update on the orders table is
        // triggered)
        queries.push(`
      WITH "x" AS (
        INSERT INTO "fill_events_2" (
          "address",
          "block",
          "block_hash",
          "tx_hash",
          "tx_index",
          "log_index",
          "timestamp",
          "batch_index",
          "order_kind",
          "order_id",
          "order_side",
          "order_source_id_int",
          "maker",
          "taker",
          "price",
          "contract",
          "token_id",
          "amount",
          "aggregator_source_id",
          "fill_source_id",
          "wash_trading_score",
          "currency",
          "currency_price",
          "usd_price",
          "is_primary"
        ) VALUES ${db_1.pgp.helpers.values(fillValues, columns)}
        ON CONFLICT ("tx_hash", "log_index", "batch_index") DO UPDATE
          SET "order_id" = EXCLUDED.order_id
        RETURNING "order_kind", "order_id", "timestamp"
      )
      UPDATE "orders" SET
        "fillability_status" = 'filled',
        "expiration" = to_timestamp("x"."timestamp"),
        "updated_at" = now()
      FROM "x"
      WHERE "orders"."id" = "x"."order_id"
        AND lower("orders"."valid_between") < to_timestamp("x"."timestamp")
    `);
    }
    if (queries.length) {
        // No need to buffer through the write queue since there
        // are no chances of database deadlocks in this scenario
        await db_1.idb.none(db_1.pgp.helpers.concat(queries));
    }
};
exports.addEventsOnChain = addEventsOnChain;
//# sourceMappingURL=on-chain.js.map