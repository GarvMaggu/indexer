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
const network_1 = require("@/config/network");
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const orders_1 = require("@/orderbook/orders");
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    const fillEvents = [];
    const nftTransferEvents = [];
    const makerInfos = [];
    const mintInfos = [];
    // For handling mints as sales
    const mintedTokens = new Map();
    // Cache the network settings
    const ns = (0, network_1.getNetworkSettings)();
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
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
                // Make sure to only handle the same data once per transaction
                const contextPrefix = `${baseEventParams.txHash}-${baseEventParams.address}-${tokenId}`;
                makerInfos.push({
                    context: `${contextPrefix}-${from}-sell-balance`,
                    maker: from,
                    trigger: {
                        kind: "balance-change",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    data: {
                        kind: "sell-balance",
                        contract: baseEventParams.address,
                        tokenId,
                    },
                });
                makerInfos.push({
                    context: `${contextPrefix}-${to}-sell-balance`,
                    maker: to,
                    trigger: {
                        kind: "balance-change",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    data: {
                        kind: "sell-balance",
                        contract: baseEventParams.address,
                        tokenId,
                    },
                });
                if (from === constants_1.AddressZero) {
                    mintInfos.push({
                        contract: baseEventParams.address,
                        tokenId,
                        mintedTimestamp: baseEventParams.timestamp,
                    });
                    if (!ns.mintsAsSalesBlacklist.includes(baseEventParams.address)) {
                        if (!mintedTokens.has(baseEventParams.txHash)) {
                            mintedTokens.set(baseEventParams.txHash, []);
                        }
                        mintedTokens.get(baseEventParams.txHash).push({
                            contract: baseEventParams.address,
                            tokenId,
                            from,
                            amount,
                            baseEventParams,
                        });
                    }
                }
                break;
            }
            case "erc1155-transfer-batch": {
                const parsedLog = eventData.abi.parseLog(log);
                const from = parsedLog.args["from"].toLowerCase();
                const to = parsedLog.args["to"].toLowerCase();
                const tokenIds = parsedLog.args["tokenIds"].map(String);
                const amounts = parsedLog.args["amounts"].map(String);
                const count = Math.min(tokenIds.length, amounts.length);
                for (let i = 0; i < count; i++) {
                    nftTransferEvents.push({
                        kind: "erc1155",
                        from,
                        to,
                        tokenId: tokenIds[i],
                        amount: amounts[i],
                        baseEventParams: {
                            ...baseEventParams,
                            batchIndex: i + 1,
                        },
                    });
                    // Make sure to only handle the same data once per transaction
                    const contextPrefix = `${baseEventParams.txHash}-${baseEventParams.address}-${tokenIds[i]}`;
                    makerInfos.push({
                        context: `${contextPrefix}-${from}-sell-balance`,
                        maker: from,
                        trigger: {
                            kind: "balance-change",
                            txHash: baseEventParams.txHash,
                            txTimestamp: baseEventParams.timestamp,
                        },
                        data: {
                            kind: "sell-balance",
                            contract: baseEventParams.address,
                            tokenId: tokenIds[i],
                        },
                    });
                    makerInfos.push({
                        context: `${contextPrefix}-${to}-sell-balance`,
                        maker: to,
                        trigger: {
                            kind: "balance-change",
                            txHash: baseEventParams.txHash,
                            txTimestamp: baseEventParams.timestamp,
                        },
                        data: {
                            kind: "sell-balance",
                            contract: baseEventParams.address,
                            tokenId: tokenIds[i],
                        },
                    });
                    if (from === constants_1.AddressZero) {
                        mintInfos.push({
                            contract: baseEventParams.address,
                            tokenId: tokenIds[i],
                            mintedTimestamp: baseEventParams.timestamp,
                        });
                        if (!ns.mintsAsSalesBlacklist.includes(baseEventParams.address)) {
                            if (!mintedTokens.has(baseEventParams.txHash)) {
                                mintedTokens.set(baseEventParams.txHash, []);
                            }
                            mintedTokens.get(baseEventParams.txHash).push({
                                contract: baseEventParams.address,
                                tokenId: tokenIds[i],
                                amount: amounts[i],
                                from,
                                baseEventParams,
                            });
                        }
                    }
                }
                break;
            }
        }
    }
    // Handle mints as sales
    for (const [txHash, mints] of mintedTokens.entries()) {
        if (mints.length > 0) {
            const tx = await utils.fetchTransaction(txHash);
            // Skip free mints
            if (tx.value === "0") {
                continue;
            }
            const totalAmount = mints
                .map(({ amount }) => amount)
                .reduce((a, b) => (0, utils_1.bn)(a).add(b).toString());
            if (totalAmount === "0") {
                continue;
            }
            const price = (0, utils_1.bn)(tx.value).div(totalAmount).toString();
            const currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
            for (const mint of mints) {
                // Handle: attribution
                const orderKind = "mint";
                const orderSource = await (0, orders_1.getOrderSourceByOrderKind)(orderKind, mint.baseEventParams.address);
                // Handle: prices
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, price, mint.baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    continue;
                }
                fillEvents.push({
                    orderKind,
                    orderSide: "sell",
                    taker: tx.from,
                    maker: mint.from,
                    amount: mint.amount,
                    currency,
                    price: priceData.nativePrice,
                    currencyPrice: price,
                    usdPrice: priceData.usdPrice,
                    contract: mint.contract,
                    tokenId: mint.tokenId,
                    // Mints have matching order and fill sources but no aggregator source
                    orderSourceId: orderSource === null || orderSource === void 0 ? void 0 : orderSource.id,
                    fillSourceId: orderSource === null || orderSource === void 0 ? void 0 : orderSource.id,
                    isPrimary: true,
                    baseEventParams: mint.baseEventParams,
                });
            }
        }
    }
    return {
        fillEvents,
        nftTransferEvents,
        makerInfos,
        mintInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=erc1155.js.map