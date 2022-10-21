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
exports.processOnChainData = void 0;
const utils_1 = require("@/common/utils");
const fills_1 = require("@/events-sync/handlers/utils/fills");
const es = __importStar(require("@/events-sync/storage"));
const processActivityEvent = __importStar(require("@/jobs/activities/process-activity-event"));
const fillUpdates = __importStar(require("@/jobs/fill-updates/queue"));
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const orderUpdatesByMaker = __importStar(require("@/jobs/order-updates/by-maker-queue"));
const orderbookOrders = __importStar(require("@/jobs/orderbook/orders-queue"));
const tokenUpdatesMint = __importStar(require("@/jobs/token-updates/mint-queue"));
// Process on-chain data (save to db, trigger any further processes, ...)
const processOnChainData = async (data, backfill) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    // Post-process fill events
    const allFillEvents = (0, utils_1.concat)(data.fillEvents, data.fillEventsPartial, data.fillEventsOnChain);
    if (!backfill) {
        await Promise.all([
            (0, fills_1.assignSourceToFillEvents)(allFillEvents),
            (0, fills_1.assignWashTradingScoreToFillEvents)(allFillEvents),
        ]);
    }
    // Persist events
    // WARNING! Fills should always come first in order to properly mark
    // the fillability status of orders as 'filled' and not 'no-balance'
    await Promise.all([
        es.fills.addEvents((_a = data.fillEvents) !== null && _a !== void 0 ? _a : []),
        es.fills.addEventsPartial((_b = data.fillEventsPartial) !== null && _b !== void 0 ? _b : []),
        es.fills.addEventsOnChain((_c = data.fillEventsOnChain) !== null && _c !== void 0 ? _c : []),
    ]);
    await Promise.all([
        es.cancels.addEvents((_d = data.cancelEvents) !== null && _d !== void 0 ? _d : []),
        es.cancels.addEventsOnChain((_e = data.cancelEventsOnChain) !== null && _e !== void 0 ? _e : []),
        es.bulkCancels.addEvents((_f = data.bulkCancelEvents) !== null && _f !== void 0 ? _f : []),
        es.nonceCancels.addEvents((_g = data.nonceCancelEvents) !== null && _g !== void 0 ? _g : []),
        es.nftApprovals.addEvents((_h = data.nftApprovalEvents) !== null && _h !== void 0 ? _h : []),
        es.ftTransfers.addEvents((_j = data.ftTransferEvents) !== null && _j !== void 0 ? _j : [], Boolean(backfill)),
        es.nftTransfers.addEvents((_k = data.nftTransferEvents) !== null && _k !== void 0 ? _k : [], Boolean(backfill)),
    ]);
    // Trigger further processes:
    // - revalidate potentially-affected orders
    // - store on-chain orders
    if (!backfill) {
        // WARNING! It's very important to guarantee that the previous
        // events are persisted to the database before any of the jobs
        // below are executed. Otherwise, the jobs can potentially use
        // stale data which will cause inconsistencies (eg. orders can
        // have wrong statuses)
        await Promise.all([
            orderUpdatesById.addToQueue((_l = data.orderInfos) !== null && _l !== void 0 ? _l : []),
            orderUpdatesByMaker.addToQueue((_m = data.makerInfos) !== null && _m !== void 0 ? _m : []),
            orderbookOrders.addToQueue((_o = data.orders) !== null && _o !== void 0 ? _o : []),
        ]);
    }
    // Mints and last sales
    await tokenUpdatesMint.addToQueue((_p = data.mintInfos) !== null && _p !== void 0 ? _p : []);
    await fillUpdates.addToQueue((_q = data.fillInfos) !== null && _q !== void 0 ? _q : []);
    // TODO: Is this the best place to handle activities?
    // Process fill activities
    const fillActivityInfos = allFillEvents.map((event) => {
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
    await processActivityEvent.addToQueue(fillActivityInfos);
    // Process transfer activities
    const transferActivityInfos = ((_r = data.nftTransferEvents) !== null && _r !== void 0 ? _r : []).map((event) => ({
        context: [
            processActivityEvent.EventKind.nftTransferEvent,
            event.baseEventParams.txHash,
            event.baseEventParams.logIndex,
            event.baseEventParams.batchIndex,
        ].join(":"),
        kind: processActivityEvent.EventKind.nftTransferEvent,
        data: {
            contract: event.baseEventParams.address,
            tokenId: event.tokenId,
            fromAddress: event.from,
            toAddress: event.to,
            amount: Number(event.amount),
            transactionHash: event.baseEventParams.txHash,
            logIndex: event.baseEventParams.logIndex,
            batchIndex: event.baseEventParams.batchIndex,
            blockHash: event.baseEventParams.blockHash,
            timestamp: event.baseEventParams.timestamp,
        },
    }));
    await processActivityEvent.addToQueue(transferActivityInfos);
};
exports.processOnChainData = processOnChainData;
//# sourceMappingURL=index.js.map