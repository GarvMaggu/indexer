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
const Sdk = __importStar(require("@reservoir0x/sdk"));
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const foundation = __importStar(require("@/orderbook/orders/foundation"));
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c;
    const cancelEventsOnChain = [];
    const fillEventsOnChain = [];
    const fillInfos = [];
    const orderInfos = [];
    // Keep track of any on-chain orders
    const orders = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "foundation-buy-price-set": {
                const parsedLog = eventData.abi.parseLog(log);
                const contract = parsedLog.args["nftContract"].toLowerCase();
                const tokenId = parsedLog.args["tokenId"].toString();
                const maker = parsedLog.args["seller"].toLowerCase();
                const price = parsedLog.args["price"].toString();
                orders.push({
                    orderParams: {
                        contract,
                        tokenId,
                        maker,
                        price,
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    metadata: {},
                });
                break;
            }
            case "foundation-buy-price-accepted": {
                const parsedLog = eventData.abi.parseLog(log);
                const contract = parsedLog.args["nftContract"].toLowerCase();
                const tokenId = parsedLog.args["tokenId"].toString();
                const maker = parsedLog.args["seller"].toLowerCase();
                let taker = parsedLog.args["buyer"].toLowerCase();
                const protocolFee = parsedLog.args["protocolFee"].toString();
                const orderId = foundation.getOrderId(contract, tokenId);
                // Handle: attribution
                const orderKind = "foundation";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                const currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                // Deduce the price from the protocol fee (which is 5%)
                const currencyPrice = (0, utils_1.bn)(protocolFee).mul(10000).div(50).toString();
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEventsOnChain.push({
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
                    // Foundation only supports ERC721
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
                    orderSide: "sell",
                    contract,
                    tokenId,
                    amount: "1",
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
            case "foundation-buy-price-invalidated":
            case "foundation-buy-price-cancelled": {
                const parsedLog = eventData.abi.parseLog(log);
                const contract = parsedLog.args["nftContract"].toLowerCase();
                const tokenId = parsedLog.args["tokenId"].toString();
                const orderId = foundation.getOrderId(contract, tokenId);
                cancelEventsOnChain.push({
                    orderKind: "foundation",
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
        }
    }
    return {
        cancelEventsOnChain,
        fillEventsOnChain,
        fillInfos,
        orders: orders.map((info) => ({
            kind: "foundation",
            info,
        })),
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=foundation.js.map