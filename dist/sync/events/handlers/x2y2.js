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
exports.handleEvents = void 0;
const abi_1 = require("@ethersproject/abi");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const erc20_1 = require("@/events-sync/handlers/utils/erc20");
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c;
    const cancelEvents = [];
    const fillEvents = [];
    const fillInfos = [];
    const orderInfos = [];
    const makerInfos = [];
    // Keep track of all events within the currently processing transaction
    let currentTx;
    let currentTxLogs = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        if (currentTx !== baseEventParams.txHash) {
            currentTx = baseEventParams.txHash;
            currentTxLogs = [];
        }
        currentTxLogs.push(log);
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "x2y2-order-cancelled": {
                const parsedLog = eventData.abi.parseLog(log);
                const orderId = parsedLog.args["itemHash"].toLowerCase();
                cancelEvents.push({
                    orderKind: "x2y2",
                    orderId,
                    baseEventParams,
                });
                orderInfos.push({
                    context: `cancelled-${orderId}-${baseEventParams.txHash}`,
                    id: orderId,
                    trigger: {
                        kind: "cancel",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                        logIndex: baseEventParams.logIndex,
                        batchIndex: baseEventParams.batchIndex,
                        blockHash: baseEventParams.blockHash,
                    },
                });
                break;
            }
            case "x2y2-order-inventory": {
                const parsedLog = eventData.abi.parseLog(log);
                const orderId = parsedLog.args["itemHash"].toLowerCase();
                const maker = parsedLog.args["maker"].toLowerCase();
                let taker = parsedLog.args["taker"].toLowerCase();
                const currency = parsedLog.args["currency"].toLowerCase();
                const item = parsedLog.args["item"];
                const op = parsedLog.args["detail"].op;
                if (![
                    Sdk.X2Y2.Types.Op.COMPLETE_SELL_OFFER,
                    Sdk.X2Y2.Types.Op.COMPLETE_BUY_OFFER,
                    Sdk.X2Y2.Types.Op.COMPLETE_AUCTION,
                ].includes(op)) {
                    // Skip any irrelevant events
                    break;
                }
                // Handle: attribution
                const orderKind = "x2y2";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                const currencyPrice = item.price.toString();
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                // Decode the sold token (ignoring bundles)
                let contract;
                let tokenId;
                try {
                    const decodedItems = abi_1.defaultAbiCoder.decode(["(address contract, uint256 tokenId)[]"], item.data);
                    if (decodedItems[0].length !== 1) {
                        break;
                    }
                    contract = decodedItems[0][0].contract.toLowerCase();
                    tokenId = decodedItems[0][0].tokenId.toString();
                }
                catch {
                    break;
                }
                const orderSide = [
                    Sdk.X2Y2.Types.Op.COMPLETE_SELL_OFFER,
                    Sdk.X2Y2.Types.Op.COMPLETE_AUCTION,
                ].includes(op)
                    ? "sell"
                    : "buy";
                fillEvents.push({
                    orderKind,
                    orderId,
                    orderSide,
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: priceData.usdPrice,
                    contract,
                    tokenId,
                    // TODO: Support X2Y2 ERC1155 orders
                    amount: "1",
                    orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                    fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                    baseEventParams,
                });
                orderInfos.push({
                    context: `filled-${orderId}-${baseEventParams.txHash}`,
                    id: orderId,
                    trigger: {
                        kind: "sale",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                });
                fillInfos.push({
                    context: `${orderId}-${baseEventParams.txHash}`,
                    orderId: orderId,
                    orderSide,
                    contract,
                    tokenId,
                    amount: "1",
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                // If an ERC20 transfer occured in the same transaction as a sale
                // then we need resync the maker's ERC20 approval to the exchange
                const erc20 = (0, erc20_1.getERC20Transfer)(currentTxLogs);
                if (erc20) {
                    makerInfos.push({
                        context: `${baseEventParams.txHash}-buy-approval`,
                        maker,
                        trigger: {
                            kind: "approval-change",
                            txHash: baseEventParams.txHash,
                            txTimestamp: baseEventParams.timestamp,
                        },
                        data: {
                            kind: "buy-approval",
                            contract: erc20,
                            orderKind: "x2y2",
                        },
                    });
                }
                break;
            }
        }
    }
    return {
        cancelEvents,
        fillEvents,
        fillInfos,
        orderInfos,
        makerInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=x2y2.js.map