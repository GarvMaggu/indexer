"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEvents = exports.addEvents = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const addEvents = async (events) => {
    const approvalValues = [];
    for (const event of events) {
        approvalValues.push({
            address: (0, utils_1.toBuffer)(event.baseEventParams.address),
            block: event.baseEventParams.block,
            block_hash: (0, utils_1.toBuffer)(event.baseEventParams.blockHash),
            tx_hash: (0, utils_1.toBuffer)(event.baseEventParams.txHash),
            tx_index: event.baseEventParams.txIndex,
            log_index: event.baseEventParams.logIndex,
            timestamp: event.baseEventParams.timestamp,
            batch_index: event.baseEventParams.batchIndex,
            owner: (0, utils_1.toBuffer)(event.owner),
            operator: (0, utils_1.toBuffer)(event.operator),
            approved: event.approved,
        });
    }
    let query;
    if (approvalValues.length) {
        const columns = new db_1.pgp.helpers.ColumnSet([
            "address",
            "block",
            "block_hash",
            "tx_hash",
            "tx_index",
            "log_index",
            "timestamp",
            "batch_index",
            "owner",
            "operator",
            "approved",
        ], { table: "nft_approval_events" });
        query = `
      INSERT INTO "nft_approval_events" (
        "address",
        "block",
        "block_hash",
        "tx_hash",
        "tx_index",
        "log_index",
        "timestamp",
        "batch_index",
        "owner",
        "operator",
        "approved"
      ) VALUES ${db_1.pgp.helpers.values(approvalValues, columns)}
      ON CONFLICT DO NOTHING
    `;
    }
    if (query) {
        // No need to buffer through the write queue since there
        // are no chances of database deadlocks in this scenario
        await db_1.idb.none(query);
    }
};
exports.addEvents = addEvents;
const removeEvents = async (block, blockHash) => {
    // Delete the approval events but skip reverting order status updates
    // since it might mess up other higher-level order processes.
    await db_1.idb.any(`
      DELETE FROM nft_approval_events
      WHERE block = $/block/
        AND block_hash = $/blockHash/
    `, {
        block,
        blockHash: (0, utils_1.toBuffer)(blockHash),
    });
};
exports.removeEvents = removeEvents;
//# sourceMappingURL=nft-approval-events.js.map