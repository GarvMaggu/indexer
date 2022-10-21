"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFtApproval = exports.saveFtApproval = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const saveFtApproval = async (ftApproval) => {
    await db_1.idb.none(`
      INSERT INTO ft_approvals (
        token,
        owner,
        spender,
        value
      ) VALUES (
        $/token/,
        $/owner/,
        $/spender/,
        $/value/
      )
      ON CONFLICT (token, owner, spender)
      DO UPDATE SET
        value = $/value/
    `, {
        token: (0, utils_1.toBuffer)(ftApproval.token),
        owner: (0, utils_1.toBuffer)(ftApproval.owner),
        spender: (0, utils_1.toBuffer)(ftApproval.spender),
        value: ftApproval.value,
    });
    return ftApproval;
};
exports.saveFtApproval = saveFtApproval;
const getFtApproval = async (token, owner, spender) => db_1.redb
    .oneOrNone(`
        SELECT
          ft_approvals.value
        FROM ft_approvals
        WHERE ft_approvals.token = $/token/
          AND ft_approvals.owner = $/owner/
          AND ft_approvals.spender = $/spender/
      `, {
    token: (0, utils_1.toBuffer)(token),
    owner: (0, utils_1.toBuffer)(owner),
    spender: (0, utils_1.toBuffer)(spender),
})
    .then((result) => result
    ? {
        token,
        owner,
        spender,
        value: result.value,
    }
    : undefined);
exports.getFtApproval = getFtApproval;
//# sourceMappingURL=index.js.map