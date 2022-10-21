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
const index_1 = require("@/config/index");
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c, _d, _e;
    const fillEvents = [];
    const fillInfos = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "nouns-auction-settled": {
                const { args } = eventData.abi.parseLog(log);
                const tokenId = args["nounId"].toString();
                const winner = args["winner"].toLowerCase();
                const amount = args["amount"].toString();
                // Handle: attribution
                const orderKind = "nouns";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                // Handle: prices
                const currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, amount, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                const maker = (_a = Sdk.Nouns.Addresses.AuctionHouse[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                const contract = (_b = Sdk.Nouns.Addresses.TokenContract[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase();
                if (maker && contract) {
                    fillEvents.push({
                        orderKind,
                        orderSide: "sell",
                        maker,
                        taker: winner,
                        amount: "1",
                        currency,
                        price: priceData.nativePrice,
                        currencyPrice: amount,
                        usdPrice: priceData.usdPrice,
                        contract,
                        tokenId,
                        // Mints have matching order and fill sources but no aggregator source
                        orderSourceId: (_c = attributionData.orderSource) === null || _c === void 0 ? void 0 : _c.id,
                        fillSourceId: (_d = attributionData.orderSource) === null || _d === void 0 ? void 0 : _d.id,
                        isPrimary: true,
                        baseEventParams,
                    });
                    fillInfos.push({
                        context: `nouns-${tokenId}-${baseEventParams.txHash}`,
                        orderSide: "sell",
                        contract: (_e = Sdk.Nouns.Addresses.TokenContract[index_1.config.chainId]) === null || _e === void 0 ? void 0 : _e.toLowerCase(),
                        tokenId,
                        amount: "1",
                        price: priceData.nativePrice,
                        timestamp: baseEventParams.timestamp,
                    });
                }
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
//# sourceMappingURL=nouns.js.map