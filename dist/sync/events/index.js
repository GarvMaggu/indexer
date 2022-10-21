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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsyncEvents = exports.syncEvents = void 0;
const abi_1 = require("@ethersproject/abi");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const lodash_1 = __importDefault(require("lodash"));
const p_limit_1 = __importDefault(require("p-limit"));
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
const data_1 = require("@/events-sync/data");
const fills_1 = require("@/events-sync/handlers/utils/fills");
const parser_1 = require("@/events-sync/parser");
const es = __importStar(require("@/events-sync/storage"));
const syncEventsUtils = __importStar(require("@/events-sync/utils"));
const blocksModel = __importStar(require("@/models/blocks"));
const prices_1 = require("@/utils/prices");
const processActivityEvent = __importStar(require("@/jobs/activities/process-activity-event"));
const removeUnsyncedEventsActivities = __importStar(require("@/jobs/activities/remove-unsynced-events-activities"));
const blockCheck = __importStar(require("@/jobs/events-sync/block-check-queue"));
const eventsSyncBackfillProcess = __importStar(require("@/jobs/events-sync/process/backfill"));
const eventsSyncRealtimeProcess = __importStar(require("@/jobs/events-sync/process/realtime"));
const fillUpdates = __importStar(require("@/jobs/fill-updates/queue"));
const syncEvents = async (fromBlock, toBlock, options) => {
    var _a, _b;
    const backfill = Boolean(options === null || options === void 0 ? void 0 : options.backfill);
    // Cache the blocks for efficiency
    const blocksCache = new Map();
    // Keep track of all handled `${block}-${blockHash}` pairs
    const blocksSet = new Set();
    // If the block range we're trying to sync is small enough, then fetch everything
    // related to every of those blocks a priori for efficiency. Otherwise, it can be
    // too inefficient to do it and in this case we just proceed (and let any further
    // processes fetch those blocks as needed / if needed).
    if (toBlock - fromBlock + 1 <= 32) {
        const limit = (0, p_limit_1.default)(32);
        await Promise.all(lodash_1.default.range(fromBlock, toBlock + 1).map((block) => limit(() => syncEventsUtils.fetchBlock(block))));
    }
    // Generate the events filter with one of the following options:
    // - fetch all events
    // - fetch a subset of all events
    // - fetch all events from a particular address
    // By default, we want to get all events
    let eventFilter = {
        topics: [[...new Set((0, data_1.getEventData)().map(({ topic }) => topic))]],
        fromBlock,
        toBlock,
    };
    if (((_a = options === null || options === void 0 ? void 0 : options.syncDetails) === null || _a === void 0 ? void 0 : _a.method) === "events") {
        // Filter to a subset of events
        eventFilter = {
            topics: [[...new Set((0, data_1.getEventData)(options.syncDetails.events).map(({ topic }) => topic))]],
            fromBlock,
            toBlock,
        };
    }
    else if (((_b = options === null || options === void 0 ? void 0 : options.syncDetails) === null || _b === void 0 ? void 0 : _b.method) === "address") {
        // Filter to all events of a particular address
        eventFilter = {
            address: options.syncDetails.address,
            fromBlock,
            toBlock,
        };
    }
    // TODO: Remove
    const fillInfos = [];
    // TODO: Remove
    const enhancedEvents = [];
    await provider_1.baseProvider.getLogs(eventFilter).then(async (logs) => {
        var _a, _b, _c;
        // TODO: Remove
        const fillEvents = [];
        const fillEventsPartial = [];
        // TODO: Remove
        const availableEventData = (0, data_1.getEventData)();
        for (const log of logs) {
            try {
                const baseEventParams = await (0, parser_1.parseEvent)(log, blocksCache);
                // Cache the block data
                if (!blocksCache.has(baseEventParams.block)) {
                    // It's very important from a performance perspective to have
                    // the block data available before proceeding with the events
                    // (otherwise we might have to perform too many db reads)
                    blocksCache.set(baseEventParams.block, await blocksModel.saveBlock({
                        number: baseEventParams.block,
                        hash: baseEventParams.blockHash,
                        timestamp: baseEventParams.timestamp,
                    }));
                }
                // Keep track of the block
                blocksSet.add(`${log.blockNumber}-${log.blockHash}`);
                // Find first matching event:
                // - matching topic
                // - matching number of topics (eg. indexed fields)
                // - matching addresses
                const eventData = availableEventData.find(({ addresses, topic, numTopics }) => log.topics[0] === topic &&
                    log.topics.length === numTopics &&
                    (addresses ? addresses[log.address.toLowerCase()] : true));
                if (eventData) {
                    enhancedEvents.push({
                        kind: eventData.kind,
                        baseEventParams,
                        log,
                    });
                }
                // TODO: Remove
                switch (eventData === null || eventData === void 0 ? void 0 : eventData.kind) {
                    // Rarible
                    case "rarible-match": {
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
                        const orderKind = eventData.kind.startsWith("universe") ? "universe" : "rarible";
                        const data = await syncEventsUtils.extractAttributionData(baseEventParams.txHash, orderKind);
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
                        fillEventsPartial.push({
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
                // TODO: Remove
            }
            catch (error) {
                logger_1.logger.info("sync-events", `Failed to handle events: ${error}`);
                throw error;
            }
        }
        // Process the retrieved events asynchronously
        const eventsSyncProcess = backfill ? eventsSyncBackfillProcess : eventsSyncRealtimeProcess;
        await eventsSyncProcess.addToQueue([
            {
                kind: "erc20",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("erc20") || kind.startsWith("weth")),
            },
            {
                kind: "erc721",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("erc721")),
            },
            {
                kind: "erc1155",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("erc1155")),
            },
            {
                kind: "blur",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("blur")),
            },
            {
                kind: "cryptopunks",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("cryptopunks")),
            },
            {
                kind: "element",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("element")),
            },
            {
                kind: "foundation",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("foundation")),
            },
            {
                kind: "looks-rare",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("looks-rare") ||
                    // To properly validate bids, we need some additional events
                    kind === "erc20-transfer"),
            },
            {
                kind: "nftx",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("nftx")),
            },
            {
                kind: "nouns",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("nouns")),
            },
            {
                kind: "quixotic",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("quixotic")),
            },
            {
                kind: "seaport",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("seaport") ||
                    // To properly validate bids, we need some additional events
                    kind === "erc20-transfer"),
            },
            {
                kind: "sudoswap",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("sudoswap")),
            },
            {
                kind: "wyvern",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("wyvern") ||
                    // To properly handle Wyvern sales, we need some additional events
                    kind === "erc721-transfer" ||
                    kind === "erc1155-transfer-single" ||
                    kind === "erc20-transfer"),
            },
            {
                kind: "x2y2",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("x2y2") ||
                    // To properly validate bids, we need some additional events
                    kind === "erc20-transfer"),
            },
            {
                kind: "zeroex-v4",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("zeroex-v4") ||
                    // To properly validate bids, we need some additional events
                    kind === "erc20-transfer"),
            },
            {
                kind: "zora",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("zora")),
            },
            {
                kind: "universe",
                events: enhancedEvents.filter(({ kind }) => kind.startsWith("universe")),
            },
        ]);
        // Make sure to recheck the ingested blocks with a delay in order to undo any reorgs
        const ns = (0, network_1.getNetworkSettings)();
        if (!backfill && ns.enableReorgCheck) {
            for (const blockData of blocksSet.values()) {
                const block = Number(blockData.split("-")[0]);
                const blockHash = blockData.split("-")[1];
                // Act right away if the current block is a duplicate
                if ((await blocksModel.getBlocks(block)).length > 1) {
                    await blockCheck.addToQueue(block, blockHash, 10);
                    await blockCheck.addToQueue(block, blockHash, 30);
                }
            }
            // Put all fetched blocks on a delayed queue
            await Promise.all([...blocksSet.values()].map(async (blockData) => {
                const block = Number(blockData.split("-")[0]);
                const blockHash = blockData.split("-")[1];
                return Promise.all(ns.reorgCheckFrequency.map((frequency) => blockCheck.addToQueue(block, blockHash, frequency * 60)));
            }));
        }
        // TODO: Remove
        if (!backfill) {
            // Assign accurate sources to the fill events
            await Promise.all([
                (0, fills_1.assignSourceToFillEvents)(fillEvents),
                (0, fills_1.assignSourceToFillEvents)(fillEventsPartial),
            ]);
            // Assign wash trading scores to the fill events
            await Promise.all([
                (0, fills_1.assignWashTradingScoreToFillEvents)(fillEvents),
                (0, fills_1.assignWashTradingScoreToFillEvents)(fillEventsPartial),
            ]);
        }
        await Promise.all([
            es.fills.addEvents(fillEvents),
            es.fills.addEventsPartial(fillEventsPartial),
        ]);
        await fillUpdates.addToQueue(fillInfos);
        // Add all the fill events to the activity queue
        const fillActivitiesInfo = lodash_1.default.map(lodash_1.default.concat(fillEvents, fillEventsPartial), (event) => {
            let fromAddress = event.maker;
            let toAddress = event.taker;
            if (event.orderSide === "buy") {
                fromAddress = event.taker;
                toAddress = event.maker;
            }
            return {
                kind: processActivityEvent.EventKind.fillEvent,
                data: {
                    contract: event.contract,
                    tokenId: event.tokenId,
                    fromAddress,
                    toAddress,
                    price: Number(event.price),
                    amount: Number(event.amount),
                    transactionHash: event.baseEventParams.txHash,
                    logIndex: event.baseEventParams.logIndex,
                    batchIndex: event.baseEventParams.batchIndex,
                    blockHash: event.baseEventParams.blockHash,
                    timestamp: event.baseEventParams.timestamp,
                    orderId: event.orderId || "",
                    orderSourceIdInt: Number(event.orderSourceId),
                },
            };
        });
        if (!lodash_1.default.isEmpty(fillActivitiesInfo)) {
            await processActivityEvent.addToQueue(fillActivitiesInfo);
        }
        // TODO: Remove
    });
};
exports.syncEvents = syncEvents;
const unsyncEvents = async (block, blockHash) => {
    await Promise.all([
        es.fills.removeEvents(block, blockHash),
        es.bulkCancels.removeEvents(block, blockHash),
        es.nonceCancels.removeEvents(block, blockHash),
        es.cancels.removeEvents(block, blockHash),
        es.ftTransfers.removeEvents(block, blockHash),
        es.nftApprovals.removeEvents(block, blockHash),
        es.nftTransfers.removeEvents(block, blockHash),
        removeUnsyncedEventsActivities.addToQueue(blockHash),
    ]);
};
exports.unsyncEvents = unsyncEvents;
//# sourceMappingURL=index.js.map