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
const constants_1 = require("@ethersproject/constants");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c, _d, _e, _f;
    const nftTransferEvents = [];
    const fillEvents = [];
    const fillInfos = [];
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
            // Wyvern v2 / v2.3 are both decomissioned, but we still keep handling
            // fill events from them in order to get historical sales. Relevant to
            // backfilling only.
            case "wyvern-v2-orders-matched":
            case "wyvern-v2.3-orders-matched": {
                const parsedLog = eventData.abi.parseLog(log);
                let buyOrderId = parsedLog.args["buyHash"].toLowerCase();
                const sellOrderId = parsedLog.args["sellHash"].toLowerCase();
                const maker = parsedLog.args["maker"].toLowerCase();
                let taker = parsedLog.args["taker"].toLowerCase();
                let currencyPrice = parsedLog.args["price"].toString();
                // With Wyvern, there are two main issues:
                // - the traded token is not included in the fill event, so we have
                // to deduce it by checking the nft transfer occured exactly before
                // the fill event
                // - the payment token is not included in the fill event, and we deduce
                // it as well by checking any ERC20 transfers that occured close before
                // the fill event (and default to the native token if cannot find any)
                // Detect the traded token
                let associatedNftTransferEvent;
                if (nftTransferEvents.length) {
                    // Ensure the last NFT transfer event was part of the fill
                    const event = nftTransferEvents[nftTransferEvents.length - 1];
                    if (event.baseEventParams.txHash === baseEventParams.txHash &&
                        event.baseEventParams.logIndex === baseEventParams.logIndex - 1 &&
                        // Only single token fills are supported and recognized
                        event.baseEventParams.batchIndex === 1) {
                        associatedNftTransferEvent = event;
                        currencyPrice = (0, utils_1.bn)(currencyPrice).div(event.amount).toString();
                    }
                }
                if (!associatedNftTransferEvent) {
                    // Skip if we can't associate to an NFT transfer event
                    break;
                }
                // Detect the payment token
                let currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                for (const log of currentTxLogs.slice(0, -1).reverse()) {
                    // Skip once we detect another fill in the same transaction
                    // (this will happen if filling through an aggregator)
                    if (log.topics[0] === (0, data_1.getEventData)([eventData.kind])[0].topic) {
                        break;
                    }
                    // If we detect an ERC20 transfer as part of the same transaction
                    // then we assume it's the payment for the current sale
                    const erc20EventData = (0, data_1.getEventData)(["erc20-transfer"])[0];
                    if (log.topics[0] === erc20EventData.topic &&
                        log.topics.length === erc20EventData.numTopics) {
                        const parsed = erc20EventData.abi.parseLog(log);
                        const from = parsed.args["from"].toLowerCase();
                        const to = parsed.args["to"].toLowerCase();
                        const amount = parsed.args["amount"].toString();
                        if (((maker === from && taker === to) || (maker === to && taker === from)) &&
                            amount <= currencyPrice) {
                            currency = log.address.toLowerCase();
                            break;
                        }
                    }
                }
                // Handle: attribution
                const orderKind = eventData.kind.startsWith("wyvern-v2.3") ? "wyvern-v2.3" : "wyvern-v2";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                // Do not double-count explicit order matching
                if (buyOrderId !== constants_1.HashZero && sellOrderId !== constants_1.HashZero) {
                    buyOrderId = constants_1.HashZero;
                }
                if (buyOrderId !== constants_1.HashZero) {
                    fillEvents.push({
                        orderKind,
                        orderId: buyOrderId,
                        orderSide: "buy",
                        maker,
                        taker,
                        price: priceData.nativePrice,
                        currency,
                        currencyPrice,
                        usdPrice: priceData.usdPrice,
                        contract: associatedNftTransferEvent.baseEventParams.address,
                        tokenId: associatedNftTransferEvent.tokenId,
                        amount: associatedNftTransferEvent.amount,
                        orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                        aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                        fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                        baseEventParams,
                    });
                    fillInfos.push({
                        context: `${buyOrderId}-${baseEventParams.txHash}`,
                        orderId: buyOrderId,
                        orderSide: "buy",
                        contract: associatedNftTransferEvent.baseEventParams.address,
                        tokenId: associatedNftTransferEvent.tokenId,
                        amount: associatedNftTransferEvent.amount,
                        price: priceData.nativePrice,
                        timestamp: baseEventParams.timestamp,
                    });
                }
                if (sellOrderId !== constants_1.HashZero) {
                    fillEvents.push({
                        orderKind,
                        orderId: sellOrderId,
                        orderSide: "sell",
                        maker,
                        taker,
                        price: priceData.nativePrice,
                        currency,
                        currencyPrice,
                        usdPrice: priceData.usdPrice,
                        contract: associatedNftTransferEvent.baseEventParams.address,
                        tokenId: associatedNftTransferEvent.tokenId,
                        amount: associatedNftTransferEvent.amount,
                        orderSourceId: (_d = attributionData.orderSource) === null || _d === void 0 ? void 0 : _d.id,
                        aggregatorSourceId: (_e = attributionData.aggregatorSource) === null || _e === void 0 ? void 0 : _e.id,
                        fillSourceId: (_f = attributionData.fillSource) === null || _f === void 0 ? void 0 : _f.id,
                        baseEventParams,
                    });
                    fillInfos.push({
                        context: `${sellOrderId}-${baseEventParams.txHash}`,
                        orderId: sellOrderId,
                        orderSide: "sell",
                        contract: associatedNftTransferEvent.baseEventParams.address,
                        tokenId: associatedNftTransferEvent.tokenId,
                        amount: associatedNftTransferEvent.amount,
                        price: priceData.nativePrice,
                        timestamp: baseEventParams.timestamp,
                    });
                }
                break;
            }
            case "erc721-transfer": {
                const parsedLog = eventData.abi.parseLog(log);
                const from = parsedLog.args["from"].toLowerCase();
                const to = parsedLog.args["to"].toLowerCase();
                const tokenId = parsedLog.args["tokenId"].toString();
                nftTransferEvents.push({
                    kind: "erc721",
                    from,
                    to,
                    tokenId,
                    amount: "1",
                    baseEventParams,
                });
                break;
            }
            case "erc1155-transfer-single": {
                const parsedLog = eventData.abi.parseLog(log);
                const from = parsedLog.args["from"].toLowerCase();
                const to = parsedLog.args["to"].toLowerCase();
                const tokenId = parsedLog.args["tokenId"].toString();
                const amount = parsedLog.args["amount"].toString();
                nftTransferEvents.push({
                    kind: "erc1155",
                    from,
                    to,
                    tokenId,
                    amount,
                    baseEventParams,
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
//# sourceMappingURL=wyvern.js.map