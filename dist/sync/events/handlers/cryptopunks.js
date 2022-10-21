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
const constants_1 = require("@ethersproject/constants");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const index_1 = require("@/config/index");
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const cryptopunks = __importStar(require("@/orderbook/orders/cryptopunks"));
const prices_1 = require("@/utils/prices");
const handleEvents = async (events) => {
    var _a, _b, _c, _d;
    const cancelEventsOnChain = [];
    const fillEventsOnChain = [];
    const nftTransferEvents = [];
    const fillInfos = [];
    const mintInfos = [];
    const orderInfos = [];
    // Keep track of any on-chain orders
    const orders = [];
    // Keep track of any Cryptopunks transfers (for working around a contract bug)
    const transfers = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "cryptopunks-punk-offered": {
                const parsedLog = eventData.abi.parseLog(log);
                const tokenId = parsedLog.args["punkIndex"].toString();
                const price = parsedLog.args["minValue"].toString();
                const taker = parsedLog.args["toAddress"].toLowerCase();
                orders.push({
                    orderParams: {
                        maker: (await utils.fetchTransaction(baseEventParams.txHash)).from.toLowerCase(),
                        side: "sell",
                        tokenId,
                        price,
                        taker: taker !== constants_1.AddressZero ? taker : undefined,
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    metadata: {},
                });
                break;
            }
            case "cryptopunks-punk-no-longer-for-sale": {
                const parsedLog = eventData.abi.parseLog(log);
                const tokenId = parsedLog.args["punkIndex"].toString();
                const orderId = cryptopunks.getOrderId(tokenId);
                cancelEventsOnChain.push({
                    orderKind: "cryptopunks",
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
            case "cryptopunks-punk-bought": {
                const { args } = eventData.abi.parseLog(log);
                const tokenId = args["punkIndex"].toString();
                let value = args["value"].toString();
                const fromAddress = args["fromAddress"].toLowerCase();
                let toAddress = args["toAddress"].toLowerCase();
                // Due to an upstream issue with the Punks contract, the `PunkBought`
                // event is emitted with zeroed `toAddress` and `value` fields when a
                // bid acceptance transaction is triggered. See the following issue:
                // https://github.com/larvalabs/cryptopunks/issues/19
                // To work around this, we get the correct `toAddress` from the most
                // recent `Transfer` event which includes the correct taker
                if (transfers.length && transfers[transfers.length - 1].txHash === baseEventParams.txHash) {
                    toAddress = transfers[transfers.length - 1].to;
                }
                // To get the correct price that the bid was settled at we have to
                // parse the transaction's calldata and extract the `minPrice` arg
                // where applicable (if the transaction was a bid acceptance one)
                const tx = await utils.fetchTransaction(baseEventParams.txHash);
                const iface = new abi_1.Interface(["function acceptBidForPunk(uint punkIndex, uint minPrice)"]);
                try {
                    const result = iface.decodeFunctionData("acceptBidForPunk", tx.data);
                    value = result.minPrice.toString();
                }
                catch {
                    // Skip any errors
                }
                if (value === "0") {
                    // Skip if the sell was for a price of zero (since in that case it was probably
                    // not even a sell, but a hacky way of setting an approval for Cryptopunks)
                    break;
                }
                const orderSide = toAddress === constants_1.AddressZero ? "buy" : "sell";
                const maker = orderSide === "sell" ? fromAddress : toAddress;
                let taker = orderSide === "sell" ? toAddress : fromAddress;
                // Handle: attribution
                const orderKind = "cryptopunks";
                const attributionData = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (attributionData.taker) {
                    taker = attributionData.taker;
                }
                // Handle: prices
                const priceData = await (0, prices_1.getUSDAndNativePrices)(Sdk.Common.Addresses.Eth[index_1.config.chainId], value, baseEventParams.timestamp);
                if (!priceData.nativePrice) {
                    // We must always have the native price
                    break;
                }
                nftTransferEvents.push({
                    kind: "cryptopunks",
                    from: fromAddress,
                    to: toAddress,
                    tokenId,
                    amount: "1",
                    baseEventParams,
                });
                const orderId = cryptopunks.getOrderId(tokenId);
                fillEventsOnChain.push({
                    orderId,
                    orderKind,
                    orderSide,
                    maker,
                    taker,
                    price: priceData.nativePrice,
                    currencyPrice: value,
                    usdPrice: priceData.usdPrice,
                    currency: Sdk.Common.Addresses.Eth[index_1.config.chainId],
                    contract: (_a = baseEventParams.address) === null || _a === void 0 ? void 0 : _a.toLowerCase(),
                    tokenId,
                    amount: "1",
                    orderSourceId: (_b = attributionData.orderSource) === null || _b === void 0 ? void 0 : _b.id,
                    aggregatorSourceId: (_c = attributionData.aggregatorSource) === null || _c === void 0 ? void 0 : _c.id,
                    fillSourceId: (_d = attributionData.fillSource) === null || _d === void 0 ? void 0 : _d.id,
                    baseEventParams,
                });
                orderInfos.push({
                    context: `filled-${orderId}-${baseEventParams.txHash}`,
                    id: orderId,
                    trigger: {
                        kind: "sale",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                });
                fillInfos.push({
                    context: orderId,
                    orderId: orderId,
                    orderSide: "sell",
                    contract: Sdk.CryptoPunks.Addresses.Exchange[index_1.config.chainId],
                    tokenId,
                    amount: "1",
                    price: priceData.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
            case "cryptopunks-punk-transfer": {
                const { args } = eventData.abi.parseLog(log);
                const from = args["from"].toLowerCase();
                const to = args["to"].toLowerCase();
                const tokenId = args["punkIndex"].toString();
                nftTransferEvents.push({
                    kind: "cryptopunks",
                    from,
                    to,
                    tokenId,
                    amount: "1",
                    baseEventParams,
                });
                break;
            }
            case "cryptopunks-assign": {
                const { args } = eventData.abi.parseLog(log);
                const to = args["to"].toLowerCase();
                const tokenId = args["punkIndex"].toString();
                nftTransferEvents.push({
                    kind: "cryptopunks",
                    from: constants_1.AddressZero,
                    to,
                    tokenId,
                    amount: "1",
                    baseEventParams,
                });
                mintInfos.push({
                    contract: baseEventParams.address,
                    tokenId,
                    mintedTimestamp: baseEventParams.timestamp,
                });
                break;
            }
            case "cryptopunks-transfer": {
                const { args } = eventData.abi.parseLog(log);
                const to = args["to"].toLowerCase();
                transfers.push({
                    to,
                    txHash: baseEventParams.txHash,
                });
                break;
            }
        }
    }
    return {
        fillEventsOnChain,
        cancelEventsOnChain,
        nftTransferEvents,
        fillInfos,
        orderInfos,
        mintInfos,
        orders: orders.map((info) => ({
            kind: "cryptopunks",
            info,
        })),
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=cryptopunks.js.map