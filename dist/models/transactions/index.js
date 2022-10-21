"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransaction = exports.saveTransaction = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const saveTransaction = async (transaction) => {
    await db_1.idb.none(`
      INSERT INTO transactions (
        hash,
        "from",
        "to",
        value,
        data,
        block_number,
        block_timestamp,
        gas_price,
        gas_used,
        gas_fee
      ) VALUES (
        $/hash/,
        $/from/,
        $/to/,
        $/value/,
        $/data/,
        $/blockNumber/,
        $/blockTimestamp/,
        $/gasPrice/,
        $/gasUsed/,
        $/gasFee/
      )
      ON CONFLICT DO NOTHING
    `, {
        hash: (0, utils_1.toBuffer)(transaction.hash),
        from: (0, utils_1.toBuffer)(transaction.from),
        to: (0, utils_1.toBuffer)(transaction.to),
        value: transaction.value,
        data: (0, utils_1.toBuffer)(transaction.data),
        blockNumber: transaction.blockNumber,
        blockTimestamp: transaction.blockTimestamp,
        gasPrice: transaction.gasPrice,
        gasUsed: transaction.gasUsed,
        gasFee: transaction.gasFee,
    });
    return transaction;
};
exports.saveTransaction = saveTransaction;
const getTransaction = async (hash) => {
    const result = await db_1.idb.oneOrNone(`
      SELECT
        transactions.from,
        transactions.to,
        transactions.value,
        transactions.data
      FROM transactions
      WHERE transactions.hash = $/hash/
    `, { hash: (0, utils_1.toBuffer)(hash) });
    return {
        hash,
        from: (0, utils_1.fromBuffer)(result.from),
        to: (0, utils_1.fromBuffer)(result.to),
        value: result.value,
        data: (0, utils_1.fromBuffer)(result.data),
    };
};
exports.getTransaction = getTransaction;
//# sourceMappingURL=index.js.map