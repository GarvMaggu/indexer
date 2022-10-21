"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const collections_1 = require("@/models/collections");
const registry_1 = require("@/utils/royalties/registry");
const QUEUE_NAME = "collections-metadata-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 1000,
        removeOnFail: 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { contract, tokenId } = job.data;
        if (await (0, redis_1.acquireLock)(QUEUE_NAME, 1)) {
            logger_1.logger.info(QUEUE_NAME, `Refresh collection metadata=${contract}`);
            await (0, redis_1.acquireLock)(`${QUEUE_NAME}:${contract}`, 60 * 60); // lock this contract for the next hour
            try {
                await collections_1.Collections.updateCollectionCache(contract, tokenId);
                await (0, registry_1.refreshRegistryRoyalties)(contract);
            }
            catch (error) {
                logger_1.logger.error(QUEUE_NAME, `Failed to update collection metadata=${error}`);
            }
        }
        else {
            job.data.addToQueue = true;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("completed", async (job) => {
        if (job.data.addToQueue) {
            const { contract, tokenId } = job.data;
            await (0, exports.addToQueue)(contract, tokenId, 1000);
        }
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (contract, tokenId = "1", delay = 0, forceRefresh = false) => {
    if (lodash_1.default.isArray(contract)) {
        await exports.queue.addBulk(lodash_1.default.map(contract, (c) => ({
            name: (0, crypto_1.randomUUID)(),
            data: { contract: c, tokenId },
            opts: { delay },
        })));
    }
    else {
        if (forceRefresh || lodash_1.default.isNull(await redis_1.redis.get(`${QUEUE_NAME}:${contract}`))) {
            await exports.queue.add((0, crypto_1.randomUUID)(), { contract, tokenId }, { delay });
        }
    }
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=metadata-queue.js.map