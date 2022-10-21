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
exports.offChainCheckBundle = exports.offChainCheck = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
const onChainData = __importStar(require("@/utils/on-chain-data"));
const offChainCheck = async (order, options) => {
    const id = order.hash();
    // Check: order has a known format
    const info = order.getInfo();
    if (!info) {
        throw new Error("unknown-format");
    }
    // Check: order is on a known and valid contract
    const kind = await commonHelpers.getContractKind(info.contract);
    if (!kind || kind !== info.tokenKind) {
        throw new Error("invalid-target");
    }
    if (options === null || options === void 0 ? void 0 : options.checkFilledOrCancelled) {
        // Check: order is not cancelled
        const cancelled = await commonHelpers.isOrderCancelled(id);
        if (cancelled) {
            throw new Error("cancelled");
        }
        // Check: order is not filled
        const quantityFilled = await commonHelpers.getQuantityFilled(id);
        if (quantityFilled.gte(info.amount)) {
            throw new Error("filled");
        }
    }
    // Check: order has a valid nonce
    const minNonce = await commonHelpers.getMinNonce("seaport", order.params.offerer);
    if (!minNonce.eq(order.params.counter)) {
        throw new Error("cancelled");
    }
    const conduit = new Sdk.Seaport.Exchange(index_1.config.chainId).deriveConduit(order.params.conduitKey);
    let hasBalance = true;
    let hasApproval = true;
    if (info.side === "buy") {
        // Check: maker has enough balance
        const ftBalance = await commonHelpers.getFtBalance(info.paymentToken, order.params.offerer);
        if (ftBalance.lt(info.price)) {
            hasBalance = false;
        }
        if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
            if ((0, utils_1.bn)(await onChainData
                .fetchAndUpdateFtApproval(info.paymentToken, order.params.offerer, conduit)
                .then((a) => a.value)).lt(info.price)) {
                hasApproval = false;
            }
        }
    }
    else {
        // Check: maker has enough balance
        const nftBalance = await commonHelpers.getNftBalance(info.contract, info.tokenId, order.params.offerer);
        if (nftBalance.lt(info.amount)) {
            hasBalance = false;
        }
        // Check: maker has set the proper approval
        const nftApproval = await commonHelpers.getNftApproval(info.contract, order.params.offerer, conduit);
        if (!nftApproval) {
            if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
                // Re-validate the approval on-chain to handle some edge-cases
                const contract = info.tokenKind === "erc721"
                    ? new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, info.contract)
                    : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, info.contract);
                if (!(await contract.isApproved(order.params.offerer, conduit))) {
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
const offChainCheckBundle = async (order, options) => {
    const id = order.hash();
    // Check: order has a known format
    const info = order.getInfo();
    if (!info) {
        throw new Error("unknown-format");
    }
    if (options === null || options === void 0 ? void 0 : options.checkFilledOrCancelled) {
        // Check: order is not cancelled
        const cancelled = await commonHelpers.isOrderCancelled(id);
        if (cancelled) {
            throw new Error("cancelled");
        }
        // Check: order is not filled
        const quantityFilled = await commonHelpers.getQuantityFilled(id);
        if (quantityFilled.gte(1)) {
            throw new Error("filled");
        }
    }
    // Check: order has a valid nonce
    const minNonce = await commonHelpers.getMinNonce("seaport", order.params.offerer);
    if (!minNonce.eq(order.params.counter)) {
        throw new Error("cancelled");
    }
    const conduit = new Sdk.Seaport.Exchange(index_1.config.chainId).deriveConduit(order.params.conduitKey);
    let hasBalance = true;
    let hasApproval = true;
    for (const item of order.getInfo().offerItems) {
        // Check: maker has enough balance
        const nftBalance = await commonHelpers.getNftBalance(item.contract, item.tokenId, order.params.offerer);
        if (nftBalance.lt(item.amount || 1)) {
            hasBalance = false;
        }
        // Check: maker has set the proper approval
        const nftApproval = await commonHelpers.getNftApproval(item.contract, order.params.offerer, conduit);
        if (!nftApproval) {
            if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
                // Re-validate the approval on-chain to handle some edge-cases
                const contract = item.tokenKind === "erc721"
                    ? new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, item.contract)
                    : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, item.contract);
                if (!(await contract.isApproved(order.params.offerer, conduit))) {
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
exports.offChainCheckBundle = offChainCheckBundle;
//# sourceMappingURL=check.js.map