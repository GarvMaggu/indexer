"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const index_1 = require("@/arweave-sync/index");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_2 = require("@/config/index");
const QUEUE_NAME = "arweave-sync-backfill";
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
// BACKGROUND WORKER ONLY
if (index_2.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { fromBlock, toBlock } = job.data;
        try {
            logger_1.logger.info(QUEUE_NAME, `Arweave backfill syncing block range [${fromBlock}, ${toBlock}]`);
            let { lastCursor, done } = await (0, index_1.syncArweave)({ fromBlock, toBlock });
            while (!done) {
                ({ lastCursor, done } = await (0, index_1.syncArweave)({
                    fromBlock,
                    toBlock,
                    afterCursor: lastCursor,
                }));
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Arweave backfill syncing failed: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (fromBlock, toBlock, options) => {
    var _a;
    // Syncing is done in several batches as for events syncing
    const blocksPerBatch = (_a = options === null || options === void 0 ? void 0 : options.blocksPerBatch) !== null && _a !== void 0 ? _a : 4;
    // Sync in reverse to handle more recent events first
    const jobs = [];
    for (let to = toBlock; to >= fromBlock; to -= blocksPerBatch) {
        const from = Math.max(fromBlock, to - blocksPerBatch + 1);
        jobs.push({
            name: `${from}-${to}`,
            data: {
                fromBlock: from,
                toBlock: to,
            },
        });
    }
    await exports.queue.addBulk(jobs);
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-queue.js.map