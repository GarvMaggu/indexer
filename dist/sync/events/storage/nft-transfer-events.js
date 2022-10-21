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
const index_1 = require("@/config/index");
const nftTransfersWriteBuffer = __importStar(require("@/jobs/events-sync/write-buffers/nft-transfers"));
const addEvents = async (events, backfill) => {
    // Keep track of all unique contracts and tokens
    const uniqueContracts = new Set();
    const uniqueTokens = new Set();
    const transferValues = [];
    const contractValues = [];
    const tokenValues = [];
    for (const event of events) {
        transferValues.push({
            address: (0, utils_1.toBuffer)(event.baseEventParams.address),
            block: event.baseEventParams.block,
            block_hash: (0, utils_1.toBuffer)(event.baseEventParams.blockHash),
            tx_hash: (0, utils_1.toBuffer)(event.baseEventParams.txHash),
            tx_index: event.baseEventParams.txIndex,
            log_index: event.baseEventParams.logIndex,
            timestamp: event.baseEventParams.timestamp,
            batch_index: event.baseEventParams.batchIndex,
            from: (0, utils_1.toBuffer)(event.from),
            to: (0, utils_1.toBuffer)(event.to),
            token_id: event.tokenId,
            amount: event.amount,
        });
        const contractId = event.baseEventParams.address.toString();
        if (!uniqueContracts.has(contractId)) {
            contractValues.push({
                address: (0, utils_1.toBuffer)(event.baseEventParams.address),
                kind: event.kind,
            });
        }
        const tokenId = `${contractId}-${event.tokenId}`;
        if (!uniqueTokens.has(tokenId)) {
            tokenValues.push({
                collection_id: event.baseEventParams.address,
                contract: (0, utils_1.toBuffer)(event.baseEventParams.address),
                token_id: event.tokenId,
            });
        }
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
            "batch_index",
            "from",
            "to",
            "token_id",
            "amount",
        ], { table: "nft_transfer_events" });
        // Atomically insert the transfer events and update balances
        queries.push(`
      WITH "x" AS (
        INSERT INTO "nft_transfer_events" (
          "address",
          "block",
          "block_hash",
          "tx_hash",
          "tx_index",
          "log_index",
          "timestamp",
          "batch_index",
          "from",
          "to",
          "token_id",
          "amount"
        ) VALUES ${db_1.pgp.helpers.values(transferValues, columns)}
        ON CONFLICT DO NOTHING
        RETURNING
          "address",
          "token_id",
          ARRAY["from", "to"] AS "owners",
          ARRAY[-"amount", "amount"] AS "amount_deltas",
          ARRAY[NULL, to_timestamp("timestamp")] AS "timestamps"
      )
      INSERT INTO "nft_balances" (
        "contract",
        "token_id",
        "owner",
        "amount",
        "acquired_at"
      ) (
        SELECT
          "y"."address",
          "y"."token_id",
          "y"."owner",
          SUM("y"."amount_delta"),
          MIN("y"."timestamp")
        FROM (
          SELECT
            "address",
            "token_id",
            unnest("owners") AS "owner",
            unnest("amount_deltas") AS "amount_delta",
            unnest("timestamps") AS "timestamp"
          FROM "x"
        ) "y"
        GROUP BY "y"."address", "y"."token_id", "y"."owner"
      )
      ON CONFLICT ("contract", "token_id", "owner") DO
      UPDATE SET 
        "amount" = "nft_balances"."amount" + "excluded"."amount", 
        "acquired_at" = COALESCE(GREATEST("excluded"."acquired_at", "nft_balances"."acquired_at"), "nft_balances"."acquired_at")
    `);
    }
    if (contractValues.length) {
        const columns = new db_1.pgp.helpers.ColumnSet(["address", "kind"], {
            table: "contracts",
        });
        queries.push(`
      INSERT INTO "contracts" (
        "address",
        "kind"
      ) VALUES ${db_1.pgp.helpers.values(contractValues, columns)}
      ON CONFLICT DO NOTHING
    `);
    }
    if (tokenValues.length) {
        if (!index_1.config.liquidityOnly) {
            const columns = new db_1.pgp.helpers.ColumnSet(["contract", "token_id"], {
                table: "tokens",
            });
            queries.push(`
        INSERT INTO "tokens" (
          "contract",
          "token_id"
        ) VALUES ${db_1.pgp.helpers.values(tokenValues, columns)}
        ON CONFLICT DO NOTHING
      `);
        }
        else {
            const columns = new db_1.pgp.helpers.ColumnSet(["collection_id", "contract", "token_id"], {
                table: "tokens",
            });
            queries.push(`
        INSERT INTO "tokens" (
          "collection_id",
          "contract",
          "token_id"
        ) VALUES ${db_1.pgp.helpers.values(tokenValues, columns)}
        ON CONFLICT DO NOTHING
      `);
        }
    }
    if (queries.length) {
        if (backfill) {
            // When backfilling, use the write buffer to avoid deadlocks
            await nftTransfersWriteBuffer.addToQueue(db_1.pgp.helpers.concat(queries));
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
        DELETE FROM "nft_transfer_events"
        WHERE "block" = $/block/ AND "block_hash" = $/blockHash/
        RETURNING
          "address",
          "token_id",
          ARRAY["from", "to"] AS "owners",
          ARRAY["amount", -"amount"] AS "amount_deltas"
      )
      INSERT INTO "nft_balances" (
        "contract",
        "token_id",
        "owner",
        "amount"
      ) (
        SELECT
          "y"."address",
          "y"."token_id",
          "y"."owner",
          SUM("y"."amount_delta")
        FROM (
          SELECT
            "address",
            "token_id",
            unnest("owners") AS "owner",
            unnest("amount_deltas") AS "amount_delta"
          FROM "x"
        ) "y"
        GROUP BY "y"."address", "y"."token_id", "y"."owner"
      )
      ON CONFLICT ("contract", "token_id", "owner") DO
      UPDATE SET "amount" = "nft_balances"."amount" + EXCLUDED."amount"
    `, {
        block,
        blockHash: (0, utils_1.toBuffer)(blockHash),
    });
};
exports.removeEvents = removeEvents;
//# sourceMappingURL=nft-transfer-events.js.map