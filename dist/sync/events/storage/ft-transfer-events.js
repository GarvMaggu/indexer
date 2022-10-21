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
const ftTransfersWriteBuffer = __importStar(require("@/jobs/events-sync/write-buffers/ft-transfers"));
const addEvents = async (events, backfill) => {
    const transferValues = [];
    for (const event of events) {
        transferValues.push({
            address: (0, utils_1.toBuffer)(event.baseEventParams.address),
            block: event.baseEventParams.block,
            block_hash: (0, utils_1.toBuffer)(event.baseEventParams.blockHash),
            tx_hash: (0, utils_1.toBuffer)(event.baseEventParams.txHash),
            tx_index: event.baseEventParams.txIndex,
            log_index: event.baseEventParams.logIndex,
            timestamp: event.baseEventParams.timestamp,
            from: (0, utils_1.toBuffer)(event.from),
            to: (0, utils_1.toBuffer)(event.to),
            amount: event.amount,
        });
    }
    const queries = [];
    if (transferValues.length) {
        const columns = new db_1.pgp.helpers.ColumnSet([
            "address",
            "block",
            "block_hash",
            "tx_hash",
            "tx_index",
            "log_index",
            "timestamp",
            "from",
            "to",
            "amount",
        ], { table: "ft_transfer_events" });
        // Atomically insert the transfer events and update balances
        queries.push(`
      WITH "x" AS (
        INSERT INTO "ft_transfer_events" (
          "address",
          "block",
          "block_hash",
          "tx_hash",
          "tx_index",
          "log_index",
          "timestamp",
          "from",
          "to",
          "amount"
        ) VALUES ${db_1.pgp.helpers.values(transferValues, columns)}
        ON CONFLICT DO NOTHING
        RETURNING
          "address",
          ARRAY["from", "to"] AS "owners",
          ARRAY[-"amount", "amount"] AS "amount_deltas"
      )
      INSERT INTO "ft_balances" (
        "contract",
        "owner",
        "amount"
      ) (
        SELECT
          "y"."address",
          "y"."owner",
          SUM("y"."amount_delta")
        FROM (
          SELECT
            "address",
            unnest("owners") AS "owner",
            unnest("amount_deltas") AS "amount_delta"
          FROM "x"
        ) "y"
        GROUP BY "y"."address", "y"."owner"
      )
      ON CONFLICT ("contract", "owner") DO
      UPDATE SET "amount" = "ft_balances"."amount" + "excluded"."amount"
    `);
    }
    if (queries.length) {
        if (backfill) {
            // When backfilling, use the write buffer to avoid deadlocks
            await ftTransfersWriteBuffer.addToQueue(db_1.pgp.helpers.concat(queries));
        }
        else {
            // Otherwise write directly since there might be jobs that depend
            // on the events to have been written to the database at the time
            // they get to run and we have no way to easily enforce this when
            // using the write buffer.
            await db_1.idb.none(db_1.pgp.helpers.concat(queries));
        }
    }
};
exports.addEvents = addEvents;
const removeEvents = async (block, blockHash) => {
    // Atomically delete the transfer events and revert balance updates
    await db_1.idb.any(`
      WITH "x" AS (
        DELETE FROM "ft_transfer_events"
        WHERE "block" = $/block/ AND "block_hash" = $/blockHash/
        RETURNING
          "address",
          ARRAY["from", "to"] AS "owners",
          ARRAY["amount", -"amount"] AS "amount_deltas"
      )
      INSERT INTO "ft_balances" (
        "contract",
        "owner",
        "amount"
      ) (
        SELECT
          "y"."address",
          "y"."owner",
          SUM("y"."amount_delta")
        FROM (
          SELECT
            "address",
            unnest("owners") AS "owner",
            unnest("amount_deltas") AS "amount_delta"
          FROM "x"
        ) "y"
        GROUP BY "y"."address", "y"."owner"
      )
      ON CONFLICT ("contract", "owner") DO
      UPDATE SET "amount" = "ft_balances"."amount" + "excluded"."amount"
    `, {
        block,
        blockHash: (0, utils_1.toBuffer)(blockHash),
    });
};
exports.removeEvents = removeEvents;
//# sourceMappingURL=ft-transfer-events.js.map