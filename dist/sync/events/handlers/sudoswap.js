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
const evm_tx_simulator_1 = require("@georgeroman/evm-tx-simulator");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const utils = __importStar(require("@/events-sync/utils"));
const prices_1 = require("@/utils/prices");
const sudoswapUtils = __importStar(require("@/utils/sudoswap"));
const handleEvents = async (events) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const fillEvents = [];
    const fillInfos = [];
    // Keep track of any orders
    const orders = [];
    // For keeping track of all individual trades per transaction
    const trades = {
        buy: new Map(),
        sell: new Map(),
    };
    // Handle the events
    for (const { kind, baseEventParams } of events) {
        switch (kind) {
            // Sudoswap is extremely poorly designed from the perspective of events
            // that get emitted on trades. As such, we use transaction tracing when
            // we detect sales in order to get more detailed information.
            case "sudoswap-buy": {
                const swapTokenForAnyNFTs = "0x28b8aee1";
                const swapTokenForSpecificNFTs = "0x6d8b99f7";
                const txHash = baseEventParams.txHash;
                const address = baseEventParams.address;
                const txTrace = await utils.fetchTransactionTrace(txHash);
                if (!txTrace) {
                    // Skip any failed attempts to get the trace
                    break;
                }
                // Search for the corresponding internal call to the Sudoswap pool
                const tradeRank = (_a = trades.buy.get(`${txHash}-${address}`)) !== null && _a !== void 0 ? _a : 0;
                const poolCallTrace = (0, evm_tx_simulator_1.searchForCall)(txTrace.calls, {
                    to: address,
                    type: "CALL",
                    sigHashes: [swapTokenForAnyNFTs, swapTokenForSpecificNFTs],
                }, tradeRank);
                if ((poolCallTrace === null || poolCallTrace === void 0 ? void 0 : poolCallTrace.output) === "0x") {
                    // Sometimes there can be upstream bugs and the call's output gets truncated
                    logger_1.logger.error("sudoswap-events-handler", `Trace missing output: ${baseEventParams.block} - ${baseEventParams.txHash}`);
                }
                if (poolCallTrace) {
                    const sighash = poolCallTrace.input.slice(0, 10);
                    const pool = await sudoswapUtils.getPoolDetails(baseEventParams.address);
                    if (pool && sighash === swapTokenForAnyNFTs) {
                        const iface = new abi_1.Interface([
                            `
                function swapTokenForAnyNFTs(
                  uint256 numNFTs,
                  uint256 maxExpectedTokenInput,
                  address nftRecipient,
                  bool isRouter,
                  address routerCaller
                ) external returns (uint256 inputAmount)
              `,
                        ]);
                        const decodedInput = iface.decodeFunctionData("swapTokenForAnyNFTs", poolCallTrace.input);
                        // Reference: https://github.com/ledgerwatch/erigon/issues/5308
                        let estimatedInputAmount;
                        if (poolCallTrace.output !== "0x") {
                            // If the trace's output is available, decode the input amount from that
                            estimatedInputAmount = iface
                                .decodeFunctionResult("swapTokenForAnyNFTs", poolCallTrace.output)
                                .inputAmount.toString();
                        }
                        else {
                            // Otherwise, estimate the input amount
                            estimatedInputAmount = decodedInput.maxExpectedTokenInput.toString();
                        }
                        if (!estimatedInputAmount) {
                            // Skip if we can't extract the input amount
                            break;
                        }
                        let taker = decodedInput.nftRecipient;
                        const price = (0, utils_1.bn)(estimatedInputAmount).div(decodedInput.numNFTs).toString();
                        // Handle: attribution
                        const orderKind = "sudoswap";
                        const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                        if (attributionData.taker) {
                            taker = attributionData.taker;
                        }
                        // Handle: prices
                        const priceData = await (0, prices_1.getUSDAndNativePrices)(pool.token, price, baseEventParams.timestamp);
                        if (!priceData.nativePrice) {
                            // We must always have the native price
                            break;
                        }
                        // Detect the traded tokens from the trace's state changes
                        const state = (0, evm_tx_simulator_1.parseCallTrace)(poolCallTrace);
                        let i = 0;
                        for (const token of Object.keys(state[address].tokenBalanceState)) {
                            if (token.startsWith("erc721")) {
                                const tokenId = token.split(":")[2];
                                fillEvents.push({
                                    orderKind,
                                    orderSide: "sell",
                                    maker: baseEventParams.address,
                                    taker,
                                    price: priceData.nativePrice,
                                    currencyPrice: price,
                                    usdPrice: priceData.usdPrice,
                                    currency: pool.token,
                                    contract: pool.nft,
                                    tokenId,
                                    amount: "1",
                                    orderSourceId: (_b = attributionData.orderSource) === null || _b === void 0 ? void 0 : _b.id,
                                    aggregatorSourceId: (_c = attributionData.aggregatorSource) === null || _c === void 0 ? void 0 : _c.id,
                                    fillSourceId: (_d = attributionData.fillSource) === null || _d === void 0 ? void 0 : _d.id,
                                    baseEventParams: {
                                        ...baseEventParams,
                                        batchIndex: i + 1,
                                    },
                                });
                                fillInfos.push({
                                    context: `sudoswap-${pool.nft}-${tokenId}-${baseEventParams.txHash}`,
                                    orderSide: "sell",
                                    contract: pool.nft,
                                    tokenId: tokenId,
                                    amount: "1",
                                    price: priceData.nativePrice,
                                    timestamp: baseEventParams.timestamp,
                                });
                                // Make sure to increment the batch counter
                                i++;
                            }
                        }
                    }
                    else if (pool && sighash === swapTokenForSpecificNFTs) {
                        const iface = new abi_1.Interface([
                            `
                function swapTokenForSpecificNFTs(
                  uint256[] calldata nftIds,
                  uint256 maxExpectedTokenInput,
                  address nftRecipient,
                  bool isRouter,
                  address routerCaller
                ) external returns (uint256 inputAmount)
              `,
                        ]);
                        const decodedInput = iface.decodeFunctionData("swapTokenForSpecificNFTs", poolCallTrace.input);
                        // Reference: https://github.com/ledgerwatch/erigon/issues/5308
                        let estimatedInputAmount;
                        if (poolCallTrace.output !== "0x") {
                            // If the trace's output is available, decode the input amount from that
                            estimatedInputAmount = iface
                                .decodeFunctionResult("swapTokenForSpecificNFTs", poolCallTrace.output)
                                .inputAmount.toString();
                        }
                        else {
                            // Otherwise, estimate the input amount
                            estimatedInputAmount = decodedInput.maxExpectedTokenInput.toString();
                        }
                        if (!estimatedInputAmount) {
                            // Skip if we can't extract the input amount
                            break;
                        }
                        let taker = decodedInput.nftRecipient;
                        const price = (0, utils_1.bn)(estimatedInputAmount).div(decodedInput.nftIds.length).toString();
                        // Handle: attribution
                        const orderKind = "sudoswap";
                        const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                        if (attributionData.taker) {
                            taker = attributionData.taker;
                        }
                        // Handle: prices
                        const priceData = await (0, prices_1.getUSDAndNativePrices)(pool.token, price, baseEventParams.timestamp);
                        if (!priceData.nativePrice) {
                            // We must always have the native price
                            break;
                        }
                        for (let i = 0; i < decodedInput.nftIds.length; i++) {
                            const tokenId = decodedInput.nftIds[i].toString();
                            fillEvents.push({
                                orderKind,
                                orderSide: "sell",
                                maker: baseEventParams.address,
                                taker,
                                price: priceData.nativePrice,
                                currencyPrice: price,
                                usdPrice: priceData.usdPrice,
                                currency: pool.token,
                                contract: pool.nft,
                                tokenId,
                                amount: "1",
                                orderSourceId: (_e = attributionData.orderSource) === null || _e === void 0 ? void 0 : _e.id,
                                aggregatorSourceId: (_f = attributionData.aggregatorSource) === null || _f === void 0 ? void 0 : _f.id,
                                fillSourceId: (_g = attributionData.fillSource) === null || _g === void 0 ? void 0 : _g.id,
                                baseEventParams: {
                                    ...baseEventParams,
                                    batchIndex: i + 1,
                                },
                            });
                            fillInfos.push({
                                context: `sudoswap-${pool.nft}-${tokenId}-${baseEventParams.txHash}`,
                                orderSide: "sell",
                                contract: pool.nft,
                                tokenId: tokenId,
                                amount: "1",
                                price: priceData.nativePrice,
                                timestamp: baseEventParams.timestamp,
                            });
                        }
                    }
                }
                // Keep track of the "buy" trade
                trades.buy.set(`${txHash}-${address}`, tradeRank + 1);
                break;
            }
            case "sudoswap-sell": {
                const swapNFTsForToken = "0xb1d3f1c1";
                const txHash = baseEventParams.txHash;
                const address = baseEventParams.address;
                const txTrace = await utils.fetchTransactionTrace(txHash);
                if (!txTrace) {
                    // Skip any failed attempts to get the trace
                    break;
                }
                // Search for the corresponding internal call to the Sudoswap pool
                const tradeRank = (_h = trades.sell.get(`${txHash}-${address}`)) !== null && _h !== void 0 ? _h : 0;
                const poolCallTrace = (0, evm_tx_simulator_1.searchForCall)(txTrace.calls, { to: address, type: "CALL", sigHashes: [swapNFTsForToken] }, tradeRank);
                if ((poolCallTrace === null || poolCallTrace === void 0 ? void 0 : poolCallTrace.output) === "0x") {
                    // Sometimes there can be upstream bugs and the call's output gets truncated
                    logger_1.logger.error("sudoswap-events-handler", `Trace missing output: ${baseEventParams.block} - ${baseEventParams.txHash}`);
                }
                if (poolCallTrace) {
                    const sighash = poolCallTrace.input.slice(0, 10);
                    const pool = await sudoswapUtils.getPoolDetails(baseEventParams.address);
                    if (pool && sighash === swapNFTsForToken) {
                        const iface = new abi_1.Interface([
                            `
                function swapNFTsForToken(
                  uint256[] calldata nftIds,
                  uint256 minExpectedTokenOutput,
                  address payable tokenRecipient,
                  bool isRouter,
                  address routerCaller
                ) external returns (uint256 outputAmount)
              `,
                        ]);
                        const decodedInput = iface.decodeFunctionData("swapNFTsForToken", poolCallTrace.input);
                        // Reference: https://github.com/ledgerwatch/erigon/issues/5308
                        let estimatedOutputAmount;
                        if (poolCallTrace.output !== "0x") {
                            // If the trace's output is available, decode the output amount from that
                            estimatedOutputAmount = iface
                                .decodeFunctionResult("swapNFTsForToken", poolCallTrace.output)
                                .outputAmount.toString();
                        }
                        else {
                            // Otherwise, estimate the output amount
                            estimatedOutputAmount = decodedInput.minExpectedTokenOutput;
                            if (estimatedOutputAmount === "0") {
                                estimatedOutputAmount = undefined;
                            }
                        }
                        if (!estimatedOutputAmount) {
                            // Skip if we can't extract the output amount
                            break;
                        }
                        let taker = decodedInput.tokenRecipient;
                        const price = (0, utils_1.bn)(estimatedOutputAmount).div(decodedInput.nftIds.length).toString();
                        // Handle: attribution
                        const orderKind = "sudoswap";
                        const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                        if (attributionData.taker) {
                            taker = attributionData.taker;
                        }
                        // Handle: prices
                        const priceData = await (0, prices_1.getUSDAndNativePrices)(pool.token, price, baseEventParams.timestamp);
                        if (!priceData.nativePrice) {
                            // We must always have the native price
                            break;
                        }
                        for (let i = 0; i < decodedInput.nftIds.length; i++) {
                            const tokenId = decodedInput.nftIds[i].toString();
                            fillEvents.push({
                                orderKind,
                                orderSide: "buy",
                                maker: baseEventParams.address,
                                taker,
                                price: priceData.nativePrice,
                                currencyPrice: price,
                                usdPrice: priceData.usdPrice,
                                currency: pool.token,
                                contract: pool.nft,
                                tokenId,
                                amount: "1",
                                orderSourceId: (_j = attributionData.orderSource) === null || _j === void 0 ? void 0 : _j.id,
                                aggregatorSourceId: (_k = attributionData.aggregatorSource) === null || _k === void 0 ? void 0 : _k.id,
                                fillSourceId: (_l = attributionData.fillSource) === null || _l === void 0 ? void 0 : _l.id,
                                baseEventParams: {
                                    ...baseEventParams,
                                    batchIndex: i + 1,
                                },
                            });
                            fillInfos.push({
                                context: `sudoswap-${pool.nft}-${tokenId}-${baseEventParams.txHash}`,
                                orderSide: "buy",
                                contract: pool.nft,
                                tokenId: tokenId,
                                amount: "1",
                                price: priceData.nativePrice,
                                timestamp: baseEventParams.timestamp,
                            });
                        }
                    }
                }
                // Keep track of the "sell" trade
                trades.sell.set(`${txHash}-${address}`, tradeRank + 1);
                orders.push({
                    orderParams: {
                        pool: baseEventParams.address,
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    metadata: {},
                });
                break;
            }
            case "sudoswap-token-deposit": {
                orders.push({
                    orderParams: {
                        pool: baseEventParams.address,
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    metadata: {},
                });
                break;
            }
            case "sudoswap-token-withdrawal": {
                orders.push({
                    orderParams: {
                        pool: baseEventParams.address,
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    metadata: {},
                });
                break;
            }
        }
    }
    return {
        fillEvents,
        fillInfos,
        orders: orders.map((info) => ({
            kind: "sudoswap",
            info,
        })),
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=sudoswap.js.map