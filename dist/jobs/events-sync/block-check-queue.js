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
const constants_1 = require("@ethersproject/constants");
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const index_2 = require("@/events-sync/index");
const backfillEventsSync = __importStar(require("@/jobs/events-sync/backfill-queue"));
const blocksModel = __importStar(require("@/models/blocks"));
const QUEUE_NAME = "events-sync-block-check";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 30000,
        },
        removeOnComplete: 10000,
        removeOnFail: 10000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { block, blockHash } = job.data;
        try {
            // Generic method for handling an orphan block
            const handleOrphanBlock = async (block) => {
                // Resync the detected orphaned block
                await backfillEventsSync.addToQueue(block.number, block.number, {
                    prioritized: true,
                });
                await (0, index_2.unsyncEvents)(block.number, block.hash);
                // Delete the orphaned block from the `blocks` table
                await blocksModel.deleteBlock(block.number, block.hash);
                // TODO: Also delete transactions associated to the orphaned
                // block and fetch the transactions of the replacement block
            };
            // Fetch the latest upstream hash for the specified block
            const upstreamBlockHash = (await provider_1.baseProvider.getBlock(block)).hash.toLowerCase();
            // When `blockHash` is empty, force recheck all event tables
            if (!blockHash) {
                const result = await db_1.idb.manyOrNone(`
              (SELECT
                nft_transfer_events.block_hash
              FROM nft_transfer_events
              WHERE nft_transfer_events.block = $/block/)

              UNION

              (SELECT
                ft_transfer_events.block_hash
              FROM ft_transfer_events
              WHERE ft_transfer_events.block = $/block/)

              UNION

              (SELECT
                nft_approval_events.block_hash
              FROM nft_approval_events
              WHERE nft_approval_events.block = $/block/)

              UNION

              (SELECT
                fill_events_2.block_hash
              FROM fill_events_2
              WHERE fill_events_2.block = $/block/)

              UNION

              (SELECT
                cancel_events.block_hash
              FROM cancel_events
              WHERE cancel_events.block = $/block/)

              UNION

              (SELECT
                bulk_cancel_events.block_hash
              FROM bulk_cancel_events
              WHERE bulk_cancel_events.block = $/block/)
            `, { block });
                for (const { block_hash } of result) {
                    const blockHash = (0, utils_1.fromBuffer)(block_hash);
                    if (blockHash.toLowerCase() !== upstreamBlockHash.toLowerCase()) {
                        logger_1.logger.info(QUEUE_NAME, `Detected orphan block ${block} with hash ${blockHash}}`);
                        await handleOrphanBlock({ number: block, hash: blockHash });
                    }
                }
            }
            else {
                if (upstreamBlockHash.toLowerCase() !== blockHash.toLowerCase()) {
                    logger_1.logger.info(QUEUE_NAME, `Detected orphan block ${block} with hash ${blockHash}}`);
                    await handleOrphanBlock({ number: block, hash: blockHash });
                }
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Block check failed: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 10 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (block, blockHash, delayInSeconds = 0) => {
    return exports.queue.add(`${block}-${blockHash !== null && blockHash !== void 0 ? blockHash : constants_1.HashZero}-${delayInSeconds}`, {
        block,
        blockHash,
    }, {
        jobId: `${block}-${blockHash !== null && blockHash !== void 0 ? blockHash : constants_1.HashZero}-${delayInSeconds}`,
        delay: delayInSeconds * 1000,
    });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=block-check-queue.js.map