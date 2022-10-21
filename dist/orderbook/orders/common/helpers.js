"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuantityFilled = exports.isOrderCancelled = exports.isNonceCancelled = exports.getMinNonce = exports.getNftApproval = exports.getNftBalance = exports.getFtBalance = exports.getRoyalties = exports.getContractKind = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const getContractKind = async (contract) => {
    const contractResult = await db_1.redb.oneOrNone(`
      SELECT contracts.kind FROM contracts
      WHERE contracts.address = $/address/
    `, { address: (0, utils_1.toBuffer)(contract) });
    return contractResult === null || contractResult === void 0 ? void 0 : contractResult.kind;
};
exports.getContractKind = getContractKind;
const getRoyalties = async (collection) => {
    const collectionResult = await db_1.redb.oneOrNone(`
      SELECT
        collections.royalties
      FROM collections
      WHERE collections.id = $/collection/
      LIMIT 1
    `, { collection });
    return (collectionResult === null || collectionResult === void 0 ? void 0 : collectionResult.royalties) || [];
};
exports.getRoyalties = getRoyalties;
const getFtBalance = async (contract, owner) => {
    const balanceResult = await db_1.redb.oneOrNone(`
      SELECT ft_balances.amount FROM ft_balances
      WHERE ft_balances.contract = $/contract/
        AND ft_balances.owner = $/owner/
    `, {
        contract: (0, utils_1.toBuffer)(contract),
        owner: (0, utils_1.toBuffer)(owner),
    });
    return (0, utils_1.bn)(balanceResult ? balanceResult.amount : 0);
};
exports.getFtBalance = getFtBalance;
const getNftBalance = async (contract, tokenId, owner) => {
    const balanceResult = await db_1.redb.oneOrNone(`
      SELECT nft_balances.amount FROM nft_balances
      WHERE nft_balances.contract = $/contract/
        AND nft_balances.token_id = $/tokenId/
        AND nft_balances.owner = $/owner/
    `, {
        contract: (0, utils_1.toBuffer)(contract),
        tokenId,
        owner: (0, utils_1.toBuffer)(owner),
    });
    return (0, utils_1.bn)(balanceResult ? balanceResult.amount : 0);
};
exports.getNftBalance = getNftBalance;
const getNftApproval = async (contract, owner, operator) => {
    const approvalResult = await db_1.redb.oneOrNone(`
      SELECT nft_approval_events.approved FROM nft_approval_events
      WHERE nft_approval_events.address = $/address/
        AND nft_approval_events.owner = $/owner/
        AND nft_approval_events.operator = $/operator/
      ORDER BY nft_approval_events.block DESC
      LIMIT 1
    `, {
        address: (0, utils_1.toBuffer)(contract),
        owner: (0, utils_1.toBuffer)(owner),
        operator: (0, utils_1.toBuffer)(operator),
    });
    return approvalResult ? approvalResult.approved : false;
};
exports.getNftApproval = getNftApproval;
const getMinNonce = async (orderKind, maker) => {
    const bulkCancelResult = await db_1.redb.oneOrNone(`
      SELECT coalesce(
        (
          SELECT bulk_cancel_events.min_nonce FROM bulk_cancel_events
          WHERE bulk_cancel_events.order_kind = $/orderKind/
            AND bulk_cancel_events.maker = $/maker/
          ORDER BY bulk_cancel_events.min_nonce DESC
          LIMIT 1
        ),
        0
      ) AS nonce
    `, {
        orderKind,
        maker: (0, utils_1.toBuffer)(maker),
    });
    return (0, utils_1.bn)(bulkCancelResult.nonce);
};
exports.getMinNonce = getMinNonce;
const isNonceCancelled = async (orderKind, maker, nonce) => {
    const nonceCancelResult = await db_1.redb.oneOrNone(`
      SELECT nonce FROM nonce_cancel_events
      WHERE order_kind = $/orderKind/
        AND maker = $/maker/
        AND nonce = $/nonce/
    `, {
        orderKind,
        maker: (0, utils_1.toBuffer)(maker),
        nonce,
    });
    return nonceCancelResult ? true : false;
};
exports.isNonceCancelled = isNonceCancelled;
const isOrderCancelled = async (orderId) => {
    const cancelResult = await db_1.redb.oneOrNone(`
      SELECT order_id FROM cancel_events
      WHERE order_id = $/orderId/
    `, { orderId });
    return cancelResult ? true : false;
};
exports.isOrderCancelled = isOrderCancelled;
const getQuantityFilled = async (orderId) => {
    const fillResult = await db_1.redb.oneOrNone(`
      SELECT SUM(amount) AS quantity_filled FROM fill_events_2
      WHERE order_id = $/orderId/
    `, { orderId });
    return (0, utils_1.bn)(fillResult.quantity_filled || 0);
};
exports.getQuantityFilled = getQuantityFilled;
//# sourceMappingURL=helpers.js.map