"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEvents = exports.addEvents = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const addEvents = async (events, backfill = false) => {
    const nonceCancelValues = [];
    for (const event of events) {
        nonceCancelValues.push({
            address: (0, utils_1.toBuffer)(event.baseEventParams.address),
            block: event.baseEventParams.block,
            block_hash: (0, utils_1.toBuffer)(event.baseEventParams.blockHash),
            tx_hash: (0, utils_1.toBuffer)(event.baseEventParams.txHash),
            tx_index: event.baseEventParams.txIndex,
            log_index: event.baseEventParams.logIndex,
            timestamp: event.baseEventParams.timestamp,
            batch_index: event.baseEventParams.batchIndex,
            order_kind: event.orderKind,
            maker: (0, utils_1.toBuffer)(event.maker),
            nonce: event.nonce,
        });
    }
    let query;
    if (nonceCancelValues.length) {
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
            "maker",
            "nonce",
        ], { table: "nonce_cancel_events" });
        // Atomically insert the nonce cancel events and update order statuses.
        query = `
      WITH "x" AS (
        INSERT INTO "nonce_cancel_events" (
          "address",
          "block",
          "block_hash",
          "tx_hash",
          "tx_index",
          "log_index",
          "timestamp",
          "batch_index",
          "order_kind",
          "maker",
          "nonce"
        ) VALUES ${db_1.pgp.helpers.values(nonceCancelValues, columns)}
        ON CONFLICT DO NOTHING
        RETURNING "order_kind", "maker", "nonce", "tx_hash", "timestamp", "log_index", "batch_index", "block_hash"
      )
      UPDATE "orders" AS "o" SET
        "fillability_status" = 'cancelled',
        "expiration" = to_timestamp("x"."timestamp"),
        "updated_at" = now()
      FROM "x"
      WHERE "o"."kind" = "x"."order_kind"
        AND "o"."maker" = "x"."maker"
        AND "o"."nonce" = "x"."nonce"
        AND ("o"."fillability_status" = 'fillable' OR "o"."fillability_status" = 'no-balance')
      RETURNING "o"."id", "x"."tx_hash", "x"."timestamp", "x"."log_index", "x"."batch_index", "x"."block_hash"
    `;
    }
    if (query) {
        // No need to buffer through the write queue since there
        // are no chances of database deadlocks in this scenario
        const result = await db_1.idb.manyOrNone(query);
        if (!backfill) {
            // TODO: Ideally, we should trigger all further processing
            // pipelines one layer higher but for now we can just have
            // it here. We should also run the order status updates in
            // a job queue (since we can potentially have an unbounded
            // number of orders that need status updates and executing
            // it synchronously is not ideal).
            await orderUpdatesById.addToQueue(result.map(({ id, tx_hash, timestamp, log_index, batch_index, block_hash }) => ({
                context: `cancelled-${id}`,
                id,
                trigger: {
                    kind: "cancel",
                    txHash: (0, utils_1.fromBuffer)(tx_hash),
                    txTimestamp: timestamp,
                    logIndex: log_index,
                    batchIndex: batch_index,
                    blockHash: (0, utils_1.fromBuffer)(block_hash),
                },
            })));
        }
    }
};
exports.addEvents = addEvents;
const removeEvents = async (block, blockHash) => {
    // Delete the cancel events but skip reverting order status updates
    // since it's not possible to know what to revert to and even if we
    // knew, it might mess up other higher-level order processes.
    await db_1.idb.any(`
      DELETE FROM nonce_cancel_events
      WHERE block = $/block/
        AND block_hash = $/blockHash/
    `, {
        block,
        blockHash: (0, utils_1.toBuffer)(blockHash),
    });
};
exports.removeEvents = removeEvents;
//# sourceMappingURL=nonce-cancel-events.js.map