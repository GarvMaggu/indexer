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
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
const index_2 = require("@/events-sync/index");
const eventsSyncBackfill = __importStar(require("@/jobs/events-sync/backfill-queue"));
const QUEUE_NAME = "events-sync-realtime";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        // In order to be as lean as possible, leave retrying
        // any failed processes to be done by subsequent jobs
        removeOnComplete: true,
        removeOnFail: true,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async () => {
        try {
            // We allow syncing of up to `maxBlocks` blocks behind the head
            // of the blockchain. If we lag behind more than that, then all
            // previous blocks that we cannot cover here will be relayed to
            // the backfill queue.
            const maxBlocks = (0, network_1.getNetworkSettings)().realtimeSyncMaxBlockLag;
            const headBlock = await provider_1.baseProvider.getBlockNumber();
            // Fetch the last synced blocked
            let localBlock = Number(await redis_1.redis.get(`${QUEUE_NAME}-last-block`));
            if (localBlock >= headBlock) {
                // Nothing to sync
                return;
            }
            if (localBlock === 0) {
                localBlock = headBlock;
            }
            else {
                localBlock++;
            }
            const fromBlock = Math.max(localBlock, headBlock - maxBlocks + 1);
            logger_1.logger.info(QUEUE_NAME, `Events realtime syncing block range [${fromBlock}, ${headBlock}]`);
            await (0, index_2.syncEvents)(fromBlock, headBlock);
            // Send any remaining blocks to the backfill queue
            if (localBlock < fromBlock) {
                logger_1.logger.info(QUEUE_NAME, `Out of sync: local block ${localBlock} and upstream block ${fromBlock}`);
                await eventsSyncBackfill.addToQueue(localBlock, fromBlock - 1);
            }
            // To avoid missing any events, save the last synced block with a delay
            // in order to ensure that the latest blocks will get queried more than
            // once, which is exactly what we are looking for (since events for the
            // latest blocks might be missing due to upstream chain reorgs):
            // https://ethereum.stackexchange.com/questions/109660/eth-getlogs-and-some-missing-logs
            await redis_1.redis.set(`${QUEUE_NAME}-last-block`, headBlock - 5);
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Events realtime syncing failed: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 3 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async () => {
    await exports.queue.add((0, crypto_1.randomUUID)(), {});
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=realtime-queue.js.map