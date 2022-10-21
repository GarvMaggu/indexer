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
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
const onChainData = __importStar(require("@/utils/on-chain-data"));
const offChainCheck = async (order, options) => {
    const id = order.hashOrderKey();
    const { side } = order.getInfo();
    // Check: order has a valid target
    let kind = "";
    switch (side) {
        case "buy":
            kind = await commonHelpers.getContractKind(order.params.take.assetType.contract);
            break;
        case "sell":
            kind = await commonHelpers.getContractKind(order.params.make.assetType.contract);
            break;
        default:
            break;
    }
    if (!kind) {
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
        const orderAmount = side === "buy" ? order.params.take.value : order.params.make.value;
        if (quantityFilled.gte(orderAmount)) {
            throw new Error("filled");
        }
    }
    let hasBalance = true;
    let hasApproval = true;
    if (side === "buy") {
        // Check: maker has enough balance
        const ftBalance = await commonHelpers.getFtBalance(order.params.make.assetType.contract, order.params.maker);
        if (ftBalance.lt(order.params.make.value)) {
            hasBalance = false;
        }
        if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
            if ((0, utils_1.bn)(await onChainData
                .fetchAndUpdateFtApproval(order.params.make.assetType.contract, order.params.maker, Sdk.Universe.Addresses.Exchange[index_1.config.chainId])
                .then((a) => a.value)).lt(order.params.make.value)) {
                hasApproval = false;
            }
        }
    }
    else {
        // Check: maker has enough balance
        const nftBalance = await commonHelpers.getNftBalance(order.params.make.assetType.contract, order.params.make.assetType.tokenId, order.params.maker);
        if (nftBalance.lt(order.params.make.value)) {
            hasBalance = false;
        }
        // Check: maker has set the proper approval
        const nftApproval = await commonHelpers.getNftApproval(order.params.make.assetType.contract, order.params.maker, Sdk.Universe.Addresses.Exchange[index_1.config.chainId]);
        if (!nftApproval) {
            if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
                // Re-validate the approval on-chain to handle some edge-cases
                const contract = kind === "erc721"
                    ? new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, order.params.make.assetType.contract)
                    : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, order.params.make.assetType.contract);
                if (!(await contract.isApproved(order.params.maker, Sdk.Universe.Addresses.Exchange[index_1.config.chainId]))) {
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