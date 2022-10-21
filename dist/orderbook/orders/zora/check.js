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
exports.offChainCheck = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const db_1 = require("@/common/db");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
const zora_1 = require("@/orderbook/orders/zora");
const onChainData = __importStar(require("@/utils/on-chain-data"));
const offChainCheck = async (order, options) => {
    const id = (0, zora_1.getOrderId)(order);
    // Fetch latest cancel event
    const cancelResult = await db_1.redb.oneOrNone(`
      SELECT
        cancel_events.timestamp
      FROM cancel_events
      WHERE cancel_events.order_id = $/orderId/
      ORDER BY cancel_events.timestamp DESC
      LIMIT 1
    `, { orderId: id });
    // Fetch latest fill event
    const fillResult = await db_1.redb.oneOrNone(`
      SELECT
        fill_events_2.timestamp
      FROM fill_events_2
      WHERE fill_events_2.order_id = $/orderId/
      ORDER BY fill_events_2.timestamp DESC
      LIMIT 1
    `, { orderId: id });
    // For now, it doesn't matter whether we return "cancelled" or "filled"
    if (cancelResult && cancelResult.timestamp >= order.txTimestamp) {
        throw new Error("cancelled");
    }
    if (fillResult && fillResult.timestamp >= order.txTimestamp) {
        throw new Error("filled");
    }
    let hasBalance = true;
    let hasApproval = true;
    if (order.side === "buy") {
        // Check: maker has enough balance
        const ftBalance = await commonHelpers.getFtBalance(order.askCurrency, order.maker);
        if (ftBalance.lt(order.askPrice)) {
            hasBalance = true;
        }
        if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
            if ((0, utils_1.bn)(await onChainData
                .fetchAndUpdateFtApproval(order.askCurrency, order.maker, Sdk.Zora.Addresses.Erc20TransferHelper[index_1.config.chainId])
                .then((a) => a.value)).lt(order.askPrice)) {
                hasApproval = false;
            }
        }
    }
    else {
        // Check: maker has enough balance
        const nftBalance = await commonHelpers.getNftBalance(order.tokenContract, order.tokenId.toString(), order.seller);
        if (nftBalance.lt(1)) {
            hasBalance = false;
        }
        const operator = Sdk.Zora.Addresses.Erc721TransferHelper[index_1.config.chainId];
        // Check: maker has set the proper approval
        const nftApproval = await commonHelpers.getNftApproval(order.tokenContract, order.seller, operator);
        // Re-validate the approval on-chain to handle some edge-cases
        const contract = new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, order.tokenContract);
        if (!hasBalance) {
            // Fetch token owner on-chain
            const owner = await contract.getOwner(order.tokenId);
            if (owner.toLocaleLowerCase() === order.seller) {
                hasBalance = true;
            }
        }
        if (!nftApproval) {
            if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
                if (!(await contract.isApproved(order.seller, operator))) {
                    hasApproval = false;
                }
            }
            else {
                hasApproval = false;
            }
        }
    }
    if (!hasBalance && !hasApproval) {
        throw new Error("no-balance-no-approval");
    }
    else if (!hasBalance) {
        throw new Error("no-balance");
    }
    else if (!hasApproval) {
        throw new Error("no-approval");
    }
};
exports.offChainCheck = offChainCheck;
//# sourceMappingURL=check.js.map