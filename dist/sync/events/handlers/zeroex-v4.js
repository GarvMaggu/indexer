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
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const erc20_1 = require("@/events-sync/handlers/utils/erc20");
const prices_1 = require("@/utils/prices");
const handleEvents = async (events, backfill) => {
    var _a, _b, _c, _d, _e, _f;
    const nonceCancelEvents = [];
    const fillEvents = [];
    const fillEventsPartial = [];
    const fillInfos = [];
    const orderInfos = [];
    const makerInfos = [];
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
            case "zeroex-v4-erc721-order-cancelled":
            case "zeroex-v4-erc1155-order-cancelled": {
                const parsedLog = eventData.abi.parseLog(log);
                const maker = parsedLog.args["maker"].toLowerCase();
                const nonce = parsedLog.args["nonce"].toString();
                nonceCancelEvents.push({
                    orderKind: eventData.kind.startsWith("zeroex-v4-erc721")
                        ? "zeroex-v4-erc721"
                        : "zeroex-v4-erc1155",
                    maker,
                    nonce,
                    baseEventParams,
                });
                break;
            }
            case "zeroex-v4-erc721-order-filled": {
                const parsedLog = eventData.abi.parseLog(log);
                const direction = parsedLog.args["direction"];
                const maker = parsedLog.args["maker"].toLowerCase();
                let taker = parsedLog.args["taker"].toLowerCase();
                const nonce = parsedLog.args["nonce"].toString();
                const erc20Token = parsedLog.args["erc20Token"].toLowerCase();
                const erc20TokenAmount = parsedLog.args["erc20TokenAmount"].toString();
                const erc721Token = parsedLog.args["erc721Token"].toLowerCase();
                const erc721TokenId = parsedLog.args["erc721TokenId"].toString();
                // Handle: attribution
                const orderKind = "zeroex-v4-erc721";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                // By default, use the price without fees
                let currencyPrice = erc20TokenAmount;
                let orderId;
                if (!backfill) {
                    // Since the event doesn't include the exact order which got matched
                    // (it only includes the nonce, but we can potentially have multiple
                    // different orders sharing the same nonce off-chain), we attempt to
                    // detect the order id which got filled by checking the database for
                    // orders which have the exact nonce/contract/price combination
                    await db_1.idb
                        .oneOrNone(`
                SELECT
                  orders.id,
                  orders.price
                FROM orders
                WHERE orders.kind = '${orderKind}'
                  AND orders.maker = $/maker/
                  AND orders.nonce = $/nonce/
                  AND orders.contract = $/contract/
                  AND (orders.raw_data ->> 'erc20TokenAmount')::NUMERIC = $/price/
                LIMIT 1
              `, {
                        maker: (0, utils_1.toBuffer)(maker),
                        nonce,
                        contract: (0, utils_1.toBuffer)(erc721Token),
                        price: erc20TokenAmount,
                    })
                        .then((result) => {
                        if (result) {
                            orderId = result.id;
                            // Workaround the fact that 0xv4 fill events exclude the fee from the price
                            // TODO: Use tracing to get the total price (including fees) for every fill
                            currencyPrice = result.price;
                        }
                    });
                }
                let currency = erc20Token;
                if (currency === Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
                    // Map the weird ZeroEx ETH address to the default ETH address
                    currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                }
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                const orderSide = direction === 0 ? "sell" : "buy";
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
                    contract: erc721Token,
                    tokenId: erc721TokenId,
                    amount: "1",
                    orderSourceId: (_a = attributionData.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregatorSourceId: (_b = attributionData.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                    fillSourceId: (_c = attributionData.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                    baseEventParams,
                });
                // Cancel all the other orders of the maker having the same nonce
                nonceCancelEvents.push({
                    orderKind,
                    maker,
                    nonce,
                    baseEventParams,
                });
                if (orderId) {
                    orderInfos.push({
                        context: `filled-${orderId}`,
                        id: orderId,
                        trigger: {
                            kind: "sale",
                            txHash: baseEventParams.txHash,
                            txTimestamp: baseEventParams.timestamp,
                        },
                    });
                }
                fillInfos.push({
                    context: orderId || `${maker}-${nonce}`,
                    orderId: orderId,
                    orderSide,
                    contract: erc721Token,
                    tokenId: erc721TokenId,
                    amount: "1",
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                // If an ERC20 transfer occured in the same transaction as a sale
                // then we need resync the maker's ERC20 approval to the exchange
                const erc20 = (0, erc20_1.getERC20Transfer)(currentTxLogs);
                if (erc20) {
                    makerInfos.push({
                        context: `${baseEventParams.txHash}-buy-approval`,
                        maker,
                        trigger: {
                            kind: "approval-change",
                            txHash: baseEventParams.txHash,
                            txTimestamp: baseEventParams.timestamp,
                        },
                        data: {
                            kind: "buy-approval",
                            contract: erc20,
                            orderKind: orderKind,
                        },
                    });
                }
                break;
            }
            case "zeroex-v4-erc1155-order-filled": {
                const parsedLog = eventData.abi.parseLog(log);
                const direction = parsedLog.args["direction"];
                const maker = parsedLog.args["maker"].toLowerCase();
                let taker = parsedLog.args["taker"].toLowerCase();
                const nonce = parsedLog.args["nonce"].toString();
                const erc20Token = parsedLog.args["erc20Token"].toLowerCase();
                const erc20FillAmount = parsedLog.args["erc20FillAmount"].toString();
                const erc1155Token = parsedLog.args["erc1155Token"].toLowerCase();
                const erc1155TokenId = parsedLog.args["erc1155TokenId"].toString();
                const erc1155FillAmount = parsedLog.args["erc1155FillAmount"].toString();
                // Handle: attribution
                const orderKind = "zeroex-v4-erc1155";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                // By default, use the price without fees
                let currencyPrice = (0, utils_1.bn)(erc20FillAmount).div(erc1155FillAmount).toString();
                let orderId;
                if (!backfill) {
                    // For ERC1155 orders we only allow unique nonce/contract/price. Since ERC1155
                    // orders are partially fillable, we have to detect the price of an individual
                    // item from the fill amount, which might result in imprecise results. However
                    // at the moment, we can live with it
                    await db_1.idb
                        .oneOrNone(`
                SELECT
                  orders.id,
                  orders.price
                FROM orders
                WHERE orders.kind = '${orderKind}'
                  AND orders.maker = $/maker/
                  AND orders.nonce = $/nonce/
                  AND orders.contract = $/contract/
                  AND (orders.raw_data ->> 'erc20TokenAmount')::NUMERIC / (orders.raw_data ->> 'nftAmount')::NUMERIC = $/price/
                LIMIT 1
              `, {
                        maker: (0, utils_1.toBuffer)(maker),
                        nonce,
                        contract: (0, utils_1.toBuffer)(erc1155Token),
                        price: (0, utils_1.bn)(erc20FillAmount).div(erc1155FillAmount).toString(),
                    })
                        .then((result) => {
                        if (result) {
                            orderId = result.id;
                            // Workaround the fact that 0xv4 fill events exclude the fee from the price
                            // TODO: Use tracing to get the total price (including fees) for every fill
                            currencyPrice = (0, utils_1.bn)(result.price).mul(erc1155FillAmount).toString();
                        }
                    });
                }
                let currency = erc20Token;
                if (currency === Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
                    // Map the weird ZeroEx ETH address to the default ETH address
                    currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                }
                const priceData = await (0, prices_1.getUSDAndNativePrices)(currency, currencyPrice, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                const orderSide = direction === 0 ? "sell" : "buy";
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
                    contract: erc1155Token,
                    tokenId: erc1155TokenId,
                    amount: erc1155FillAmount,
                    orderSourceId: (_d = attributionData.orderSource) === null || _d === void 0 ? void 0 : _d.id,
                    aggregatorSourceId: (_e = attributionData.aggregatorSource) === null || _e === void 0 ? void 0 : _e.id,
                    fillSourceId: (_f = attributionData.fillSource) === null || _f === void 0 ? void 0 : _f.id,
                    baseEventParams,
                });
                if (orderId) {
                    orderInfos.push({
                        context: `filled-${orderId}-${baseEventParams.txHash}`,
                        id: orderId,
                        trigger: {
                            kind: "sale",
                            txHash: baseEventParams.txHash,
                            txTimestamp: baseEventParams.timestamp,
                        },
                    });
                }
                fillInfos.push({
                    context: orderId || `${maker}-${nonce}`,
                    orderId: orderId,
                    orderSide,
                    contract: erc1155Token,
                    tokenId: erc1155TokenId,
                    amount: erc1155FillAmount,
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                // If an ERC20 transfer occured in the same transaction as a sale
                // then we need resync the maker's ERC20 approval to the exchange
                const erc20 = (0, erc20_1.getERC20Transfer)(currentTxLogs);
                if (erc20) {
                    makerInfos.push({
                        context: `${baseEventParams.txHash}-buy-approval`,
                        maker,
                        trigger: {
                            kind: "approval-change",
                            txHash: baseEventParams.txHash,
                            txTimestamp: baseEventParams.timestamp,
                        },
                        data: {
                            kind: "buy-approval",
                            contract: erc20,
                            orderKind: orderKind,
                        },
                    });
                }
                break;
            }
        }
    }
    return {
        nonceCancelEvents,
        fillEvents,
        fillEventsPartial,
        fillInfos,
        orderInfos,
        makerInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=zeroex-v4.js.map