"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionTrace = exports.saveTransactionTrace = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const saveTransactionTrace = async (transactionTrace) => {
    await db_1.idb.none(`
      INSERT INTO transaction_traces (
        hash,
        calls
      ) VALUES (
        $/hash/,
        $/calls:json/
      )
      ON CONFLICT DO NOTHING
    `, {
        hash: (0, utils_1.toBuffer)(transactionTrace.hash),
        calls: transactionTrace.calls,
    });
    return transactionTrace;
};
exports.saveTransactionTrace = saveTransactionTrace;
const getTransactionTrace = async (hash) => {
    const result = await db_1.idb.oneOrNone(`
      SELECT
        transaction_traces.hash,
        transaction_traces.calls
      FROM transaction_traces
      WHERE transaction_traces.hash = $/hash/
    `, { hash: (0, utils_1.toBuffer)(hash) });
    return {
        hash,
        calls: result.calls,
    };
};
exports.getTransactionTrace = getTransactionTrace;
//# sourceMappingURL=index.js.map