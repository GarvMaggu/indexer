"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEvents = exports.addEvents = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const addEvents = async (events) => {
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
          MIN("x"."order_kind"),
          'cancelled'::order_fillability_status_t,
          MIN(to_timestamp("x"."timestamp")) AS "expiration"
        FROM "x"
        GROUP BY "x"."order_id"
      )
      ON CONFLICT ("id") DO
      UPDATE SET
        "fillability_status" = 'cancelled',
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
    // Delete the cancel events but skip reverting order status updates
    // since it's not possible to know what to revert to and even if we
    // knew, it might mess up other higher-level order processes.
    await db_1.idb.any(`
      DELETE FROM cancel_events
      WHERE block = $/block/
        AND block_hash = $/blockHash/
    `, {
        block,
        blockHash: (0, utils_1.toBuffer)(blockHash),
    });
};
exports.removeEvents = removeEvents;
//# sourceMappingURL=common.js.map