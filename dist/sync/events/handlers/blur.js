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
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c;
    const fillEvents = [];
    const fillInfos = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "blur-orders-matched": {
                const { args } = eventData.abi.parseLog(log);
                const maker = args.maker.toLowerCase();
                let taker = args.taker.toLowerCase();
                const sell = args.sell;
                const sellHash = args.sellHash.toLowerCase();
                const buyHash = args.buyHash.toLowerCase();
                // Handle: attribution
                const orderKind = "blur";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                const currency = sell.paymentToken.toLowerCase();
                const currencyPrice = sell.price.div(sell.amount).toString();
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                const orderSide = maker === sell.trader.toLowerCase() ? "sell" : "buy";
                const orderId = orderSide === "sell" ? sellHash : buyHash;
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
                    contract: sell.collection.toLowerCase(),
                    tokenId: sell.tokenId.toString(),
                    amount: sell.amount.toString(),
                    orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                    fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: `${orderId}-${baseEventParams.txHash}`,
                    orderId: orderId,
                    orderSide,
                    contract: sell.collection.toLowerCase(),
                    tokenId: sell.tokenId.toString(),
                    amount: sell.amount.toString(),
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
        }
    }
    return {
        fillEvents,
        fillInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=blur.js.map