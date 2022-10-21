"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addEventsOnChain = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const addEventsOnChain = async (events) => {
    const cancelValues = [];
    for (const event of events) {
        cancelValues.push({
            address: (0, utils_1.toBuffer)(event.baseEventParams.address),
            block: event.baseEventParams.block,
            block_hash: (0, utils_1.toBuffer)(event.baseEventParams.blockHash),
            tx_hash: (0, utils_1.toBuffer)(event.baseEventParams.txHash),
            tx_index: event.baseEventParams.txIndex,
            log_index: event.baseEventParams.logIndex,
            timestamp: event.baseEventParams.timestamp,
            order_kind: event.orderKind,
            order_id: event.orderId,
        });
    }
    const queries = [];
    if (cancelValues.length) {
        const columns = new db_1.pgp.helpers.ColumnSet([
            "address",
            "block",
            "block_hash",
            "tx_hash",
            "tx_index",
            "log_index",
            "timestamp",
            "order_kind",
            "order_id",
        ], { table: "cancel_events" });
        // Atomically insert the cancel events and update order statuses
        // NOTE: Ideally we have an `ON CONFLICT NO NOTHING` clause, but
        // in order to be able to sync sales/cancels before orders we do
        // a redundant update (so that the update on the orders table is
        // triggered)
        queries.push(`
      WITH "x" AS (
        INSERT INTO "cancel_events" (
          "address",
          "block",
          "block_hash",
          "tx_hash",
          "tx_index",
          "log_index",
          "timestamp",
          "order_kind",
          "order_id"
        ) VALUES ${db_1.pgp.helpers.values(cancelValues, columns)}
        ON CONFLICT ("block_hash", "tx_hash", "log_index") DO UPDATE
          SET "order_id" = EXCLUDED.order_id
        RETURNING "order_kind", "order_id", "timestamp"
      )
      UPDATE "orders" SET
        "fillability_status" = 'cancelled',
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