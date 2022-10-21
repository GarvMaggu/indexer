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
//TODO: Add Universe
const abi_1 = require("@ethersproject/abi");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const data_1 = require("@/events-sync/data");
const utils = __importStar(require("@/events-sync/utils"));
const prices_1 = require("@/utils/prices");
const index_1 = require("@/config/index");
const utils_1 = require("@/common/utils");
const handleEvents = async (events) => {
    var _a, _b, _c;
    const cancelEvents = [];
    const fillEvents = [];
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
            case "universe-cancel": {
                const { args } = eventData.abi.parseLog(log);
                const orderId = args["hash"].toLowerCase();
                cancelEvents.push({
                    orderKind: "universe",
                    orderId,
                    baseEventParams,
                });
                orderInfos.push({
                    context: `cancelled-${orderId}`,
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
            case "universe-match": {
                const { args } = eventData.abi.parseLog(log);
                const leftHash = args["leftHash"].toLowerCase();
                const leftMaker = args["leftMaker"].toLowerCase();
                let taker = args["rightMaker"].toLowerCase();
                const newLeftFill = args["newLeftFill"].toString();
                const newRightFill = args["newRightFill"].toString();
                const leftAsset = args["leftAsset"];
                const rightAsset = args["rightAsset"];
                const ERC20 = "0x8ae85d84";
                const ETH = "0xaaaebeba";
                const ERC721 = "0x73ad2146";
                const ERC1155 = "0x973bb640";
                const assetTypes = [ERC721, ERC1155, ERC20, ETH];
                // Exclude orders with exotic asset types
                if (!assetTypes.includes(leftAsset.assetClass) ||
                    !assetTypes.includes(rightAsset.assetClass)) {
                    break;
                }
                // Assume the left order is the maker's order
                const side = [ERC721, ERC1155].includes(leftAsset.assetClass) ? "sell" : "buy";
                const currencyAsset = side === "sell" ? rightAsset : leftAsset;
                const nftAsset = side === "sell" ? leftAsset : rightAsset;
                // Handle: attribution
                const orderKind = "universe";
                const data = await utils.extractAttributionData(baseEventParams.txHash, orderKind);
                if (data.taker) {
                    taker = data.taker;
                }
                // Handle: prices
                let currency;
                if (currencyAsset.assetClass === ETH) {
                    currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                }
                else if (currencyAsset.assetClass === ERC20) {
                    const decodedCurrencyAsset = abi_1.defaultAbiCoder.decode(["(address token)"], currencyAsset.data);
                    currency = decodedCurrencyAsset[0][0];
                }
                else {
                    break;
                }
                const decodedNftAsset = abi_1.defaultAbiCoder.decode(["(address token, uint tokenId)"], nftAsset.data);
                const contract = decodedNftAsset[0][0].toLowerCase();
                const tokenId = decodedNftAsset[0][1].toString();
                let currencyPrice = side === "sell" ? newLeftFill : newRightFill;
                const amount = side === "sell" ? newRightFill : newLeftFill;
                currencyPrice = (0, utils_1.bn)(currencyPrice).div(amount).toString();
                const prices = await (0, prices_1.getUSDAndNativePrices)(currency.toLowerCase(), currencyPrice, baseEventParams.timestamp);
                if (!prices.nativePrice) {
                    // We must always have the native price
                    break;
                }
                fillEvents.push({
                    orderKind,
                    orderId: leftHash,
                    orderSide: side,
                    maker: leftMaker,
                    taker,
                    price: prices.nativePrice,
                    currency,
                    currencyPrice,
                    usdPrice: prices.usdPrice,
                    contract,
                    tokenId,
                    amount,
                    orderSourceId: (_a = data.orderSource) === null || _a === void 0 ? void 0 : _a.id,
                    aggregatorSourceId: (_b = data.aggregatorSource) === null || _b === void 0 ? void 0 : _b.id,
                    fillSourceId: (_c = data.fillSource) === null || _c === void 0 ? void 0 : _c.id,
                    baseEventParams,
                });
                fillInfos.push({
                    context: leftHash,
                    orderId: leftHash,
                    orderSide: side,
                    contract,
                    tokenId,
                    amount,
                    price: prices.nativePrice,
                    timestamp: baseEventParams.timestamp,
                });
                break;
            }
        }
    }
    return {
        cancelEvents,
        fillEvents,
        fillInfos,
        orderInfos,
        makerInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=universe.js.map