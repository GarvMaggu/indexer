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
const zora_1 = require("@/orderbook/orders/zora");
const prices_1 = require("@/utils/prices");
const getOrderParams = (args) => {
    const tokenId = args["tokenId"].toString();
    const tokenContract = args["tokenContract"].toLowerCase();
    const ask = args["ask"];
    const askPrice = ask["askPrice"].toString();
    const askCurrency = ask["askCurrency"].toLowerCase();
    const sellerFundsRecipient = ask["sellerFundsRecipient"].toLowerCase();
    const findersFeeBps = ask["findersFeeBps"];
    return {
        tokenContract,
        tokenId,
        askPrice,
        askCurrency,
        sellerFundsRecipient,
        findersFeeBps,
    };
};
const handleEvents = async (events) => {
    var _a, _b, _c, _d, _e, _f;
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
            // Zora
            case "zora-ask-filled": {
                const { args } = eventData.abi.parseLog(log);
                const tokenContract = args["tokenContract"].toLowerCase();
                const tokenId = args["tokenId"].toString();
                let taker = args["buyer"].toLowerCase();
                const ask = args["ask"];
                const seller = ask["seller"].toLowerCase();
                const askCurrency = ask["askCurrency"].toLowerCase();
                const askPrice = ask["askPrice"].toString();
                // Handle: attribution
                const orderKind = "zora-v3";
                const data = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (data.taker) {
                    taker = data.taker;
                }
                // Handle: prices
                const prices = await (0, prices_1.getUSDAndNativePrices)(askCurrency, askPrice, baseEventParams.timestamp);
                if (!prices.nativePrice) {
                    // We must always have the native price
                    break;
                }
                const orderParams = getOrderParams(args);
                const orderId = (0, zora_1.getOrderId)(orderParams);
                fillEventsOnChain.push({
                    orderKind,
                    orderId,
                    currency: askCurrency,
                    orderSide: "sell",
                    maker: seller,
                    taker,
                    price: prices.nativePrice,
                    currencyPrice: askPrice,
                    usdPrice: prices.usdPrice,
                    contract: tokenContract,
                    tokenId,
                    amount: "1",
                    orderSourceId: (_a = data.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregatorSourceId: (_b = data.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                    fillSourceId: (_c = data.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: `zora-${tokenContract}-${tokenId}-${baseEventParams.txHash}`,
                    orderSide: "sell",
                    contract: tokenContract,
                    tokenId,
                    amount: "1",
                    price: prices.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
            case "zora-ask-created": {
                const { args } = eventData.abi.parseLog(log);
                const orderParams = getOrderParams(args);
                const maker = (await utils.fetchTransaction(baseEventParams.txHash)).from.toLowerCase();
                const seller = args["ask"]["seller"].toLowerCase();
                orders.push({
                    orderParams: {
                        seller,
                        maker,
                        side: "sell",
                        ...orderParams,
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    metadata: {},
                });
                break;
            }
            case "zora-ask-cancelled": {
                const { args } = eventData.abi.parseLog(log);
                const orderParams = getOrderParams(args);
                const orderId = (0, zora_1.getOrderId)(orderParams);
                cancelEventsOnChain.push({
                    orderKind: "zora-v3",
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
            case "zora-ask-price-updated": {
                const { args } = eventData.abi.parseLog(log);
                const orderParams = getOrderParams(args);
                const seller = args["ask"]["seller"].toLowerCase();
                orders.push({
                    orderParams: {
                        seller,
                        maker: seller,
                        side: "sell",
                        ...orderParams,
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    metadata: {},
                });
                break;
            }
            case "zora-auction-ended": {
                const { args } = eventData.abi.parseLog(log);
                const tokenId = args["tokenId"].toString();
                const tokenContract = args["tokenContract"].toLowerCase();
                const tokenOwner = args["tokenOwner"].toLowerCase();
                let taker = args["winner"].toLowerCase();
                const amount = args["amount"].toString();
                const curatorFee = args["curatorFee"].toString();
                const auctionCurrency = args["auctionCurrency"].toLowerCase();
                const price = (0, utils_1.bn)(amount).add(curatorFee).toString();
                // Handle: attribution
                const orderKind = "zora-v3";
                const data = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (data.taker) {
                    taker = data.taker;
                }
                // Handle: prices
                const prices = await (0, prices_1.getUSDAndNativePrices)(auctionCurrency, price, baseEventParams.timestamp);
                if (!prices.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEventsOnChain.push({
                    orderKind,
                    currency: auctionCurrency,
                    orderSide: "sell",
                    taker,
                    maker: tokenOwner,
                    price: prices.nativePrice,
                    currencyPrice: price,
                    usdPrice: prices.usdPrice,
                    contract: tokenContract,
                    tokenId,
                    amount: "1",
                    orderSourceId: (_d = data.orderSource) === null || _d === void 0 ? void 0 : _d.id,
                    aggregatorSourceId: (_e = data.aggregatorSource) === null || _e === void 0 ? void 0 : _e.id,
                    fillSourceId: (_f = data.fillSource) === null || _f === void 0 ? void 0 : _f.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: `zora-${tokenContract}-${tokenId}-${baseEventParams.txHash}`,
                    orderSide: "sell",
                    contract: tokenContract,
                    tokenId,
                    amount: "1",
                    price: prices.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
        }
    }
    return {
        fillEventsOnChain,
        cancelEventsOnChain,
        fillInfos,
        orderInfos,
        orders: orders.map((info) => ({
            kind: "zora-v3",
            info,
        })),
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=zora.js.map