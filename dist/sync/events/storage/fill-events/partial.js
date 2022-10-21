"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addEventsPartial = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
// TODO: Merge with `common` fill handling
const addEventsPartial = async (events) => {
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
        await db_1.idb.none(`
      WITH x AS (
        INSERT INTO fill_events_2 (
          address,
          block,
          block_hash,
          tx_hash,
          tx_index,
          log_index,
          timestamp,
          batch_index,
          order_kind,
          order_id,
          order_side,
          order_source_id_int,
          maker,
          taker,
          price,
          contract,
          token_id,
          amount,
          aggregator_source_id,
          fill_source_id,
          wash_trading_score,
          currency,
          currency_price,
          usd_price,
          is_primary
        ) VALUES ${db_1.pgp.helpers.values(fillValues, columns)}
        ON CONFLICT DO NOTHING
        RETURNING
          fill_events_2.order_kind,
          fill_events_2.order_id,
          fill_events_2.timestamp,
          fill_events_2.amount
      )
      INSERT INTO orders (
        id,
        kind,
        quantity_filled,
        fillability_status,
        expiration
      ) (
        SELECT
          x.order_id,
          MIN(x.order_kind),
          SUM(x.amount) AS amount,
          'filled'::order_fillability_status_t,
          MIN(to_timestamp(x.timestamp))
        FROM x
        WHERE x.order_id IS NOT NULL
        GROUP BY x.order_id
      )
      ON CONFLICT (id) DO
      UPDATE SET
        fillability_status = (
          CASE
            WHEN orders.quantity_remaining <= EXCLUDED.quantity_filled THEN 'filled'
            ELSE orders.fillability_status
          END
        ),
        quantity_remaining = orders.quantity_remaining - EXCLUDED.quantity_filled,
        quantity_filled = orders.quantity_filled + EXCLUDED.quantity_filled,
        expiration = (
          CASE
            WHEN orders.quantity_remaining <= EXCLUDED.quantity_filled THEN EXCLUDED.expiration
            ELSE orders.expiration
          END
        ),
        updated_at = now()
      WHERE orders.quantity_remaining > 0
    `);
    }
};
exports.addEventsPartial = addEventsPartial;
//# sourceMappingURL=partial.js.map