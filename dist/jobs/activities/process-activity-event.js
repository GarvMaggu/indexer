"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.EventKind = exports.queue = void 0;
const lodash_1 = __importDefault(require("lodash"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const sale_activity_1 = require("@/jobs/activities/sale-activity");
const transfer_activity_1 = require("@/jobs/activities/transfer-activity");
const ask_activity_1 = require("@/jobs/activities/ask-activity");
const bid_activity_1 = require("@/jobs/activities/bid-activity");
const bid_cancel_activity_1 = require("@/jobs/activities/bid-cancel-activity");
const ask_cancel_activity_1 = require("@/jobs/activities/ask-cancel-activity");
const QUEUE_NAME = "process-activity-event-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 100,
        removeOnFail: 20000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { kind, data } = job.data;
        switch (kind) {
            case EventKind.fillEvent:
                await sale_activity_1.SaleActivity.handleEvent(data);
                break;
            case EventKind.nftTransferEvent:
                await transfer_activity_1.TransferActivity.handleEvent(data);
                break;
            case EventKind.newSellOrder:
                await ask_activity_1.AskActivity.handleEvent(data);
                break;
            case EventKind.newBuyOrder:
                await bid_activity_1.BidActivity.handleEvent(data);
                break;
            case EventKind.buyOrderCancelled:
                await bid_cancel_activity_1.BidCancelActivity.handleEvent(data);
                break;
            case EventKind.sellOrderCancelled:
                await ask_cancel_activity_1.AskCancelActivity.handleEvent(data);
                break;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 15 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
var EventKind;
(function (EventKind) {
    EventKind["fillEvent"] = "fillEvent";
    EventKind["nftTransferEvent"] = "nftTransferEvent";
    EventKind["newSellOrder"] = "newSellOrder";
    EventKind["newBuyOrder"] = "newBuyOrder";
    EventKind["sellOrderCancelled"] = "sellOrderCancelled";
    EventKind["buyOrderCancelled"] = "buyOrderCancelled";
})(EventKind = exports.EventKind || (exports.EventKind = {}));
const addToQueue = async (events) => {
    await exports.queue.addBulk(lodash_1.default.map(events, (event) => ({
        name: (0, crypto_1.randomUUID)(),
        data: event,
        opts: {
            jobId: event.context,
        },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=process-activity-event.js.map