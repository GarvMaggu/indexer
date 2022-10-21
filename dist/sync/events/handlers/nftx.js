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
const prices_1 = require("@/utils/prices");
const nftxUtils = __importStar(require("@/utils/nftx"));
const handleEvents = async (events) => {
    var _a, _b, _c, _d, _e, _f;
    const fillEvents = [];
    const fillInfos = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "nftx-minted": {
                const { args } = eventData.abi.parseLog(log);
                const tokenIds = args.nftIds.map(String);
                const amounts = args.amounts.map(String);
                // Determine the total quantity of NFTs sold
                let nftCount = 0;
                for (let i = 0; i < tokenIds.length; i++) {
                    nftCount += amounts.length ? Number(amounts[i]) : 1;
                }
                const nftPool = await nftxUtils.getNftPoolDetails(baseEventParams.address);
                if (!nftPool) {
                    // Skip any failed attempts to get the pool details
                    break;
                }
                // Fetch all logs from the current transaction
                const { logs } = await utils.fetchTransactionLogs(baseEventParams.txHash);
                // Ensure there is a single `Minted` event for the same pool
                const mintEventsCount = logs.filter((log) => nftxUtils.isMint(log, baseEventParams.address)).length;
                if (mintEventsCount > 1) {
                    break;
                }
                // Ensure there is a single `Swap` event for the same pool
                const swapEventsCount = logs.filter((log) => nftxUtils.isSwap(log)).length;
                if (swapEventsCount > 1) {
                    break;
                }
                for (const log of logs) {
                    const result = await nftxUtils.tryParseSwap(log);
                    if (result &&
                        // The swap occured after the mint
                        log.logIndex > baseEventParams.logIndex &&
                        // The swap included the nft pool token
                        [result.ftPool.token0, result.ftPool.token1].includes(nftPool.address)) {
                        let currency;
                        let currencyPrice;
                        if (nftPool.address === result.ftPool.token0 && result.amount1Out !== "0") {
                            currency = result.ftPool.token1;
                            currencyPrice = (0, utils_1.bn)(result.amount1Out).div(nftCount).toString();
                        }
                        else if (nftPool.address === result.ftPool.token1 && result.amount0Out !== "0") {
                            currency = result.ftPool.token0;
                            currencyPrice = (0, utils_1.bn)(result.amount0Out).div(nftCount).toString();
                        }
                        if (currency && currencyPrice) {
                            // Handle: attribution
                            const orderKind = "nftx";
                            const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                            // Handle: prices
                            const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                            if (!priceData.nativePrice) {
                                // We must always have the native price
                                break;
                            }
                            // Always set the taker as the transaction's sender in order to cover
                            // trades made through the default NFTX marketplace zap contract that
                            // acts as a router
                            const taker = (await utils.fetchTransaction(baseEventParams.txHash)).from;
                            for (let i = 0; i < tokenIds.length; i++) {
                                fillEvents.push({
                                    orderKind,
                                    orderSide: "buy",
                                    maker: baseEventParams.address,
                                    taker,
                                    price: priceData.nativePrice,
                                    currencyPrice,
                                    usdPrice: priceData.usdPrice,
                                    currency,
                                    contract: nftPool.nft,
                                    tokenId: tokenIds[i],
                                    amount: amounts.length ? amounts[i] : "1",
                                    orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                                    aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                                    fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                                    baseEventParams: {
                                        ...baseEventParams,
                                        batchIndex: i + 1,
                                    },
                                });
                                fillInfos.push({
                                    context: `nftx-${nftPool.nft}-${tokenIds[i]}-${baseEventParams.txHash}`,
                                    orderSide: "buy",
                                    contract: nftPool.nft,
                                    tokenId: tokenIds[i],
                                    amount: amounts.length ? amounts[i] : "1",
                                    price: priceData.nativePrice,
                                    timestamp: baseEventParams.timestamp,
                                });
                            }
                        }
                    }
                }
                break;
            }
            case "nftx-redeemed": {
                const { args } = eventData.abi.parseLog(log);
                const tokenIds = args.nftIds.map(String);
                const nftPool = await nftxUtils.getNftPoolDetails(baseEventParams.address);
                if (!nftPool) {
                    // Skip any failed attempts to get the pool details
                    break;
                }
                // Fetch all logs from the current transaction
                const { logs } = await utils.fetchTransactionLogs(baseEventParams.txHash);
                // Ensure there is a single `Redeemed` event for the same pool
                const redeemEventsCount = logs.filter((log) => nftxUtils.isRedeem(log, baseEventParams.address)).length;
                if (redeemEventsCount > 1) {
                    break;
                }
                // Ensure there is a single `Swap` event for the same pool
                const swapEventsCount = logs.filter((log) => nftxUtils.isSwap(log)).length;
                if (swapEventsCount > 1) {
                    break;
                }
                for (const log of logs) {
                    const result = await nftxUtils.tryParseSwap(log);
                    if (result &&
                        // The swap occured before the redeem
                        log.logIndex < baseEventParams.logIndex &&
                        // The swap included the nft pool token
                        [result.ftPool.token0, result.ftPool.token1].includes(nftPool.address)) {
                        let currency;
                        let currencyPrice;
                        if (nftPool.address === result.ftPool.token0 && result.amount1In !== "0") {
                            currency = result.ftPool.token1;
                            currencyPrice = (0, utils_1.bn)(result.amount1In).div(tokenIds.length).toString();
                        }
                        else if (nftPool.address === result.ftPool.token1 && result.amount0In !== "0") {
                            currency = result.ftPool.token0;
                            currencyPrice = (0, utils_1.bn)(result.amount0In).div(tokenIds.length).toString();
                        }
                        if (currency && currencyPrice) {
                            // Handle: attribution
                            const orderKind = "nftx";
                            const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                            // Handle: prices
                            const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                            if (!priceData.nativePrice) {
                                // We must always have the native price
                                break;
                            }
                            // Always set the taker as the transaction's sender in order to cover
                            // trades made through the default NFTX marketplace zap contract that
                            // acts as a router
                            const taker = (await utils.fetchTransaction(baseEventParams.txHash)).from;
                            for (let i = 0; i < tokenIds.length; i++) {
                                fillEvents.push({
                                    orderKind,
                                    orderSide: "sell",
                                    maker: baseEventParams.address,
                                    taker,
                                    price: priceData.nativePrice,
                                    currencyPrice,
                                    usdPrice: priceData.usdPrice,
                                    currency,
                                    contract: nftPool.nft,
                                    tokenId: tokenIds[i],
                                    amount: "1",
                                    orderSourceId: (_d = attributionData.orderSource) === null || _d === void 0 ? void 0 : _d.id,
                                    aggregatorSourceId: (_e = attributionData.aggregatorSource) === null || _e === void 0 ? void 0 : _e.id,
                                    fillSourceId: (_f = attributionData.fillSource) === null || _f === void 0 ? void 0 : _f.id,
                                    baseEventParams: {
                                        ...baseEventParams,
                                        batchIndex: i + 1,
                                    },
                                });
                                fillInfos.push({
                                    context: `nftx-${nftPool.nft}-${tokenIds[i]}-${baseEventParams.txHash}`,
                                    orderSide: "sell",
                                    contract: nftPool.nft,
                                    tokenId: tokenIds[i],
                                    amount: "1",
                                    price: priceData.nativePrice,
                                    timestamp: baseEventParams.timestamp,
                                });
                            }
                        }
                    }
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
//# sourceMappingURL=nftx.js.map