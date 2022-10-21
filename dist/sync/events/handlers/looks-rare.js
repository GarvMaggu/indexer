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
const utils_1 = require("@/common/utils");
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const erc20_1 = require("@/events-sync/handlers/utils/erc20");
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c, _d, _e, _f;
    const bulkCancelEvents = [];
    const nonceCancelEvents = [];
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
            case "looks-rare-cancel-all-orders": {
                const parsedLog = eventData.abi.parseLog(log);
                const maker = parsedLog.args["user"].toLowerCase();
                const newMinNonce = parsedLog.args["newMinNonce"].toString();
                bulkCancelEvents.push({
                    orderKind: "looks-rare",
                    maker,
                    minNonce: newMinNonce,
                    baseEventParams,
                });
                break;
            }
            case "looks-rare-cancel-multiple-orders": {
                const parsedLog = eventData.abi.parseLog(log);
                const maker = parsedLog.args["user"].toLowerCase();
                const orderNonces = parsedLog.args["orderNonces"].map(String);
                let batchIndex = 1;
                for (const orderNonce of orderNonces) {
                    nonceCancelEvents.push({
                        orderKind: "looks-rare",
                        maker,
                        nonce: orderNonce,
                        baseEventParams: {
                            ...baseEventParams,
                            batchIndex: batchIndex++,
                        },
                    });
                }
                break;
            }
            case "looks-rare-taker-ask": {
                const parsedLog = eventData.abi.parseLog(log);
                const orderId = parsedLog.args["orderHash"].toLowerCase();
                const orderNonce = parsedLog.args["orderNonce"].toString();
                const maker = parsedLog.args["maker"].toLowerCase();
                let taker = parsedLog.args["taker"].toLowerCase();
                const currency = parsedLog.args["currency"].toLowerCase();
                let currencyPrice = parsedLog.args["price"].toString();
                const contract = parsedLog.args["collection"].toLowerCase();
                const tokenId = parsedLog.args["tokenId"].toString();
                const amount = parsedLog.args["amount"].toString();
                // Handle: attribution
                const orderKind = "looks-rare";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                currencyPrice = (0, utils_1.bn)(currencyPrice).div(amount).toString();
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEvents.push({
                    orderKind,
                    orderId,
                    orderSide: "buy",
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: priceData.usdPrice,
                    contract,
                    tokenId,
                    amount,
                    orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                    fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                    baseEventParams,
                });
                // Cancel all the other orders of the maker having the same nonce
                nonceCancelEvents.push({
                    orderKind: "looks-rare",
                    maker,
                    nonce: orderNonce,
                    baseEventParams,
                });
                orderInfos.push({
                    context: `filled-${orderId}`,
                    id: orderId,
                    trigger: {
                        kind: "sale",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                });
                fillInfos.push({
                    context: orderId,
                    orderId: orderId,
                    orderSide: "buy",
                    contract,
                    tokenId,
                    amount,
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
                            orderKind: "looks-rare",
                        },
                    });
                }
                break;
            }
            case "looks-rare-taker-bid": {
                const parsedLog = eventData.abi.parseLog(log);
                const orderId = parsedLog.args["orderHash"].toLowerCase();
                const orderNonce = parsedLog.args["orderNonce"].toString();
                const maker = parsedLog.args["maker"].toLowerCase();
                let taker = parsedLog.args["taker"].toLowerCase();
                const currency = parsedLog.args["currency"].toLowerCase();
                let currencyPrice = parsedLog.args["price"].toString();
                const contract = parsedLog.args["collection"].toLowerCase();
                const tokenId = parsedLog.args["tokenId"].toString();
                const amount = parsedLog.args["amount"].toString();
                // Handle: attribution
                const orderKind = "looks-rare";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                currencyPrice = (0, utils_1.bn)(currencyPrice).div(amount).toString();
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEvents.push({
                    orderKind,
                    orderId,
                    orderSide: "sell",
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: priceData.usdPrice,
                    contract,
                    tokenId,
                    amount,
                    orderSourceId: (_d = attributionData.orderSource) === null || _d === void 0 ? void 0 : _d.id,
                    aggregatorSourceId: (_e = attributionData.aggregatorSource) === null || _e === void 0 ? void 0 : _e.id,
                    fillSourceId: (_f = attributionData.fillSource) === null || _f === void 0 ? void 0 : _f.id,
                    baseEventParams,
                });
                // Cancel all the other orders of the maker having the same nonce
                nonceCancelEvents.push({
                    orderKind: "looks-rare",
                    maker,
                    nonce: orderNonce,
                    baseEventParams,
                });
                orderInfos.push({
                    context: `filled-${orderId}`,
                    id: orderId,
                    trigger: {
                        kind: "sale",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                });
                fillInfos.push({
                    context: orderId,
                    orderId: orderId,
                    orderSide: "sell",
                    contract,
                    tokenId,
                    amount,
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
                            orderKind: "looks-rare",
                        },
                    });
                }
                break;
            }
        }
    }
    return {
        bulkCancelEvents,
        nonceCancelEvents,
        fillEvents,
        fillInfos,
        orderInfos,
        makerInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=looks-rare.js.map