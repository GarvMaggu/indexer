"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionLogs = exports.saveTransactionLogs = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const saveTransactionLogs = async (transactionLogs) => {
    await db_1.idb.none(`
      INSERT INTO transaction_logs (
        hash,
        logs
      ) VALUES (
        $/hash/,
        $/logs:json/
      )
      ON CONFLICT DO NOTHING
    `, {
        hash: (0, utils_1.toBuffer)(transactionLogs.hash),
        logs: transactionLogs.logs,
    });
    return transactionLogs;
};
exports.saveTransactionLogs = saveTransactionLogs;
const getTransactionLogs = async (hash) => {
    const result = await db_1.idb.oneOrNone(`
      SELECT
        transaction_logs.hash,
        transaction_logs.logs
      FROM transaction_logs
      WHERE transaction_logs.hash = $/hash/
    `, { hash: (0, utils_1.toBuffer)(hash) });
    return {
        hash,
        logs: result.logs,
    };
};
exports.getTransactionLogs = getTransactionLogs;
//# sourceMappingURL=index.js.map