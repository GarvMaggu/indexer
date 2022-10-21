"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
const index_2 = require("@/events-sync/index");
const QUEUE_NAME = "events-sync-backfill";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 10000,
        },
        removeOnComplete: true,
        removeOnFail: 10000,
        timeout: 120000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER AND EVENT SYNC BACKFILLER ONLY
if (index_1.config.doBackgroundWork && index_1.config.doEventsSyncBackfill) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { fromBlock, toBlock, backfill, syncDetails } = job.data;
        try {
            logger_1.logger.info(QUEUE_NAME, `Events backfill syncing block range [${fromBlock}, ${toBlock}]`);
            await (0, index_2.syncEvents)(fromBlock, toBlock, { backfill, syncDetails });
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Events backfill syncing failed: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 15 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (fromBlock, toBlock, options) => {
    var _a, _b;
    // Syncing is done in several batches since the requested block
    // range might result in lots of events which could potentially
    // not fit within a single provider response
    const blocksPerBatch = (_a = options === null || options === void 0 ? void 0 : options.blocksPerBatch) !== null && _a !== void 0 ? _a : (0, network_1.getNetworkSettings)().backfillBlockBatchSize;
    // Important backfill processes should be prioritized
    const prioritized = (_b = options === null || options === void 0 ? void 0 : options.prioritized) !== null && _b !== void 0 ? _b : false;
    // Sync in reverse to handle more recent events first
    const jobs = [];
    for (let to = toBlock; to >= fromBlock; to -= blocksPerBatch) {
        const from = Math.max(fromBlock, to - blocksPerBatch + 1);
        jobs.push({
            name: `${from}-${to}`,
            data: {
                fromBlock: from,
                toBlock: to,
                backfill: options === null || options === void 0 ? void 0 : options.backfill,
                syncDetails: options === null || options === void 0 ? void 0 : options.syncDetails,
            },
            opts: {
                priority: prioritized ? 1 : undefined,
            },
        });
    }
    await exports.queue.addBulk(jobs);
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-queue.js.map