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
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const fillEventsPartial = [];
    const fillInfos = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            // Element
            case "element-erc721-sell-order-filled": {
                const { args } = eventData.abi.parseLog(log);
                const maker = args["maker"].toLowerCase();
                let taker = args["taker"].toLowerCase();
                const erc20Token = args["erc20Token"].toLowerCase();
                const erc20TokenAmount = args["erc20TokenAmount"].toString();
                const erc721Token = args["erc721Token"].toLowerCase();
                const erc721TokenId = args["erc721TokenId"].toString();
                const orderHash = args["orderHash"].toLowerCase();
                // Handle: attribution
                const orderKind = "element-erc721";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                let currency = erc20Token;
                if (currency === Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
                    // Map the weird ZeroEx ETH address to the default ETH address
                    currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                }
                const currencyPrice = erc20TokenAmount;
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEventsPartial.push({
                    orderKind,
                    orderId: orderHash,
                    orderSide: "sell",
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: priceData.usdPrice,
                    contract: erc721Token,
                    tokenId: erc721TokenId,
                    amount: "1",
                    orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                    fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: orderHash,
                    orderId: orderHash,
                    orderSide: "sell",
                    contract: erc721Token,
                    tokenId: erc721TokenId,
                    amount: "1",
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
            case "element-erc721-buy-order-filled": {
                const { args } = eventData.abi.parseLog(log);
                const maker = args["maker"].toLowerCase();
                let taker = args["taker"].toLowerCase();
                const erc20Token = args["erc20Token"].toLowerCase();
                const erc20TokenAmount = args["erc20TokenAmount"].toString();
                const erc721Token = args["erc721Token"].toLowerCase();
                const erc721TokenId = args["erc721TokenId"].toString();
                const orderHash = args["orderHash"].toLowerCase();
                // Handle: attribution
                const orderKind = "element-erc721";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                let currency = erc20Token;
                if (currency === Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
                    // Map the weird ZeroEx ETH address to the default ETH address
                    currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                }
                const currencyPrice = erc20TokenAmount;
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEventsPartial.push({
                    orderKind,
                    orderId: orderHash,
                    orderSide: "buy",
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: priceData.usdPrice,
                    contract: erc721Token,
                    tokenId: erc721TokenId,
                    amount: "1",
                    orderSourceId: (_d = attributionData.orderSource) === null || _d === void 0 ? void 0 : _d.id,
                    aggregatorSourceId: (_e = attributionData.aggregatorSource) === null || _e === void 0 ? void 0 : _e.id,
                    fillSourceId: (_f = attributionData.fillSource) === null || _f === void 0 ? void 0 : _f.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: orderHash,
                    orderId: orderHash,
                    orderSide: "buy",
                    contract: erc721Token,
                    tokenId: erc721TokenId,
                    amount: "1",
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
            case "element-erc1155-sell-order-filled": {
                const { args } = eventData.abi.parseLog(log);
                const maker = args["maker"].toLowerCase();
                let taker = args["taker"].toLowerCase();
                const erc20Token = args["erc20Token"].toLowerCase();
                const erc20FillAmount = args["erc20FillAmount"].toString();
                const erc1155Token = args["erc1155Token"].toLowerCase();
                const erc1155TokenId = args["erc1155TokenId"].toString();
                const erc1155FillAmount = args["erc1155FillAmount"].toString();
                const orderHash = args["orderHash"].toLowerCase();
                // Handle: attribution
                const orderKind = "element-erc1155";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                let currency = erc20Token;
                if (currency === Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
                    // Map the weird ZeroEx ETH address to the default ETH address
                    currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                }
                const currencyPrice = (0, utils_1.bn)(erc20FillAmount).div(erc1155FillAmount).toString();
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEventsPartial.push({
                    orderKind,
                    orderId: orderHash,
                    orderSide: "sell",
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: priceData.usdPrice,
                    contract: erc1155Token,
                    tokenId: erc1155TokenId,
                    amount: erc1155FillAmount,
                    orderSourceId: (_g = attributionData.orderSource) === null || _g === void 0 ? void 0 : _g.id,
                    aggregatorSourceId: (_h = attributionData.aggregatorSource) === null || _h === void 0 ? void 0 : _h.id,
                    fillSourceId: (_j = attributionData.fillSource) === null || _j === void 0 ? void 0 : _j.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: orderHash,
                    orderId: orderHash,
                    orderSide: "sell",
                    contract: erc1155Token,
                    tokenId: erc1155TokenId,
                    amount: erc1155FillAmount,
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
            case "element-erc1155-buy-order-filled": {
                const { args } = eventData.abi.parseLog(log);
                const maker = args["maker"].toLowerCase();
                let taker = args["taker"].toLowerCase();
                const erc20Token = args["erc20Token"].toLowerCase();
                const erc20FillAmount = args["erc20FillAmount"].toString();
                const erc1155Token = args["erc1155Token"].toLowerCase();
                const erc1155TokenId = args["erc1155TokenId"].toString();
                const erc1155FillAmount = args["erc1155FillAmount"].toString();
                const orderHash = args["orderHash"].toLowerCase();
                // Handle: attribution
                const orderKind = "element-erc1155";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                let currency = erc20Token;
                if (currency === Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
                    // Map the weird ZeroEx ETH address to the default ETH address
                    currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                }
                const currencyPrice = (0, utils_1.bn)(erc20FillAmount).div(erc1155FillAmount).toString();
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEventsPartial.push({
                    orderKind,
                    orderId: orderHash,
                    orderSide: "buy",
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: priceData.usdPrice,
                    contract: erc1155Token,
                    tokenId: erc1155TokenId,
                    amount: erc1155FillAmount,
                    orderSourceId: (_k = attributionData.orderSource) === null || _k === void 0 ? void 0 : _k.id,
                    aggregatorSourceId: (_l = attributionData.aggregatorSource) === null || _l === void 0 ? void 0 : _l.id,
                    fillSourceId: (_m = attributionData.fillSource) === null || _m === void 0 ? void 0 : _m.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: orderHash,
                    orderId: orderHash,
                    orderSide: "buy",
                    contract: erc1155Token,
                    tokenId: erc1155TokenId,
                    amount: erc1155FillAmount,
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
        }
    }
    return {
        fillEventsPartial,
        fillInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=element.js.map