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
    var _a, _b, _c;
    const fillEventsPartial = [];
    const fillInfos = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "quixotic-order-filled": {
                const parsedLog = eventData.abi.parseLog(log);
                const orderId = parsedLog.args["orderHash"].toLowerCase();
                const maker = parsedLog.args["offerer"].toLowerCase();
                let taker = parsedLog.args["recipient"].toLowerCase();
                const offer = parsedLog.args["offer"];
                const consideration = parsedLog.args["consideration"];
                // TODO: Switch to `Quixotic` class once integrated
                const saleInfo = new Sdk.Seaport.Exchange(index_1.config.chainId).deriveBasicSale(offer, consideration);
                if (saleInfo) {
                    // Handle: attribution
                    const orderKind = "quixotic";
                    const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                    if (attributionData.taker) {
                        taker = attributionData.taker;
                    }
                    if (saleInfo.recipientOverride) {
                        taker = saleInfo.recipientOverride;
                    }
                    // Handle: prices
                    const currency = saleInfo.paymentToken;
                    const currencyPrice = (0, utils_1.bn)(saleInfo.price).div(saleInfo.amount).toString();
                    const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                    if (!priceData.nativePrice) {
                        // We must always have the native price
                        break;
                    }
                    const orderSide = saleInfo.side;
                    fillEventsPartial.push({
                        orderKind,
                        orderId,
                        orderSide,
                        maker,
                        taker,
                        price: priceData.nativePrice,
                        currency,
                        currencyPrice,
                        usdPrice: priceData.usdPrice,
                        contract: saleInfo.contract,
                        tokenId: saleInfo.tokenId,
                        amount: saleInfo.amount,
                        orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                        aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                        fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                        baseEventParams,
                    });
                    fillInfos.push({
                        context: `${orderId}-${baseEventParams.txHash}`,
                        orderId: orderId,
                        orderSide,
                        contract: saleInfo.contract,
                        tokenId: saleInfo.tokenId,
                        amount: saleInfo.amount,
                        price: priceData.nativePrice,
                        timestamp: baseEventParams.timestamp,
                    });
                }
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
//# sourceMappingURL=quixotic.js.map