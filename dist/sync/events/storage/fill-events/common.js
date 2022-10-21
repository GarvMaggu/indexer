"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEvents = exports.addEvents = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const addEvents = async (events) => {
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
        ON CONFLICT DO NOTHING
        RETURNING "order_kind", "order_id", "timestamp"
      )
      INSERT INTO "orders" (
        "id",
        "kind",
        "fillability_status",
        "expiration"
      ) (
        SELECT
          "x"."order_id",
          "x"."order_kind",
          'filled'::order_fillability_status_t,
          to_timestamp("x"."timestamp") AS "expiration"
        FROM "x"
        WHERE "x"."order_id" IS NOT NULL
      )
      ON CONFLICT ("id") DO
      UPDATE SET
        "fillability_status" = 'filled',
        "expiration" = EXCLUDED."expiration",
        "updated_at" = now()
    `);
    }
    if (queries.length) {
        // No need to buffer through the write queue since there
        // are no chances of database deadlocks in this scenario
        await db_1.idb.none(db_1.pgp.helpers.concat(queries));
    }
};
exports.addEvents = addEvents;
const removeEvents = async (block, blockHash) => {
    // Delete the fill events but skip reverting order status updates
    // since it is not possible to know what to revert to and even if
    // we knew, it might mess up other higher-level order processes.
    await db_1.idb.any(`
      DELETE FROM fill_events_2
      WHERE block = $/block/
        AND block_hash = $/blockHash/
    `, {
        block,
        blockHash: (0, utils_1.toBuffer)(blockHash),
    });
};
exports.removeEvents = removeEvents;
//# sourceMappingURL=common.js.map