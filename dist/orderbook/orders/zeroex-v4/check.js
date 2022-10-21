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
    // TODO: We should also check the remaining quantity for partially filled orders.
    var _a, _b, _c;
    const id = order.hash();
    // Check: order has a valid target
    const kind = await commonHelpers.getContractKind(order.params.nft);
    if (!kind || kind !== ((_a = order.params.kind) === null || _a === void 0 ? void 0 : _a.split("-")[0])) {
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
        if (quantityFilled.gte((_b = order.params.nftAmount) !== null && _b !== void 0 ? _b : 1)) {
            throw new Error("filled");
        }
    }
    // Check: order's nonce was not individually cancelled
    const nonceCancelled = await commonHelpers.isNonceCancelled(`zeroex-v4-${kind}`, order.params.maker, order.params.nonce);
    if (nonceCancelled) {
        throw new Error("cancelled");
    }
    const feeAmount = order.getFeeAmount();
    let hasBalance = true;
    let hasApproval = true;
    if (order.params.direction === Sdk.ZeroExV4.Types.TradeDirection.BUY) {
        // Check: maker has enough balance
        const ftBalance = await commonHelpers.getFtBalance(order.params.erc20Token, order.params.maker);
        if (ftBalance.lt((0, utils_1.bn)(order.params.erc20TokenAmount).add(feeAmount))) {
            hasBalance = false;
        }
        if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
            if ((0, utils_1.bn)(await onChainData
                .fetchAndUpdateFtApproval(order.params.erc20Token, order.params.maker, Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId])
                .then((a) => a.value)).lt((0, utils_1.bn)(order.params.erc20TokenAmount).add(feeAmount))) {
                hasApproval = false;
            }
        }
    }
    else {
        // Check: maker has enough balance
        const nftBalance = await commonHelpers.getNftBalance(order.params.nft, order.params.nftId, order.params.maker);
        if (nftBalance.lt((_c = order.params.nftAmount) !== null && _c !== void 0 ? _c : 1)) {
            hasBalance = false;
        }
        const operator = Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId];
        // Check: maker has set the proper approval
        const nftApproval = await commonHelpers.getNftApproval(order.params.nft, order.params.maker, operator);
        if (!nftApproval) {
            if (options === null || options === void 0 ? void 0 : options.onChainApprovalRecheck) {
                // Re-validate the approval on-chain to handle some edge-cases
                const contract = kind === "erc721"
                    ? new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, order.params.nft)
                    : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, order.params.nft);
                if (!(await contract.isApproved(order.params.maker, operator))) {
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