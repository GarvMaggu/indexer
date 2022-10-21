"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
exports.addToQueue = exports.getLockName = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const tokens_1 = require("@/models/tokens");
const flagStatusGenerateCollectionTokenSet = __importStar(require("@/jobs/flag-status/generate-collection-token-set"));
const metadata_api_1 = __importDefault(require("@/utils/metadata-api"));
const pending_flag_status_sync_tokens_1 = require("@/models/pending-flag-status-sync-tokens");
const flagStatusProcessQueue = __importStar(require("@/jobs/flag-status/process-queue"));
const crypto_1 = require("crypto");
const lodash_1 = __importDefault(require("lodash"));
const QUEUE_NAME = "flag-status-sync-queue";
const LIMIT = 40;
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
        const { collectionId, contract } = job.data;
        let delay = 2500;
        // Get the tokens from the list
        const pendingFlagStatusSyncTokensQueue = new pending_flag_status_sync_tokens_1.PendingFlagStatusSyncTokens(collectionId);
        const pendingSyncFlagStatusTokens = await pendingFlagStatusSyncTokensQueue.get(LIMIT);
        if (pendingSyncFlagStatusTokens.length == 0) {
            logger_1.logger.info(QUEUE_NAME, `Sync completed. collectionId:${collectionId}, contract:${contract}`);
            await (0, redis_1.releaseLock)((0, exports.getLockName)());
            await flagStatusProcessQueue.addToQueue();
            await flagStatusGenerateCollectionTokenSet.addToQueue(contract, collectionId);
            return;
        }
        const pendingSyncFlagStatusTokensChunks = lodash_1.default.chunk(pendingSyncFlagStatusTokens, 20);
        await Promise.all(pendingSyncFlagStatusTokensChunks.map(async (pendingSyncFlagStatusTokensChunk) => {
            var _a;
            try {
                const tokensMetadata = await metadata_api_1.default.getTokensMetadata(pendingSyncFlagStatusTokensChunk, true);
                for (const pendingSyncFlagStatusToken of pendingSyncFlagStatusTokensChunk) {
                    const tokenMetadata = tokensMetadata.find((tokenMetadata) => tokenMetadata.tokenId === pendingSyncFlagStatusToken.tokenId);
                    if (!tokenMetadata) {
                        logger_1.logger.warn(QUEUE_NAME, `Missing Token Metadata. collectionId:${collectionId}, contract:${contract}, tokenId: ${pendingSyncFlagStatusToken.tokenId}, tokenIsFlagged:${pendingSyncFlagStatusToken.isFlagged}`);
                        continue;
                    }
                    const isFlagged = Number(tokenMetadata.flagged);
                    if (pendingSyncFlagStatusToken.isFlagged != isFlagged) {
                        logger_1.logger.info(QUEUE_NAME, `Flag Status Diff. collectionId:${collectionId}, contract:${contract}, tokenId: ${pendingSyncFlagStatusToken.tokenId}, tokenIsFlagged:${pendingSyncFlagStatusToken.isFlagged}, isFlagged:${isFlagged}`);
                    }
                    await tokens_1.Tokens.update(contract, pendingSyncFlagStatusToken.tokenId, {
                        isFlagged,
                        lastFlagUpdate: new Date().toISOString(),
                    });
                }
            }
            catch (error) {
                if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
                    logger_1.logger.info(QUEUE_NAME, `Too Many Requests. collectionId:${collectionId}, contract:${contract}, error: ${JSON.stringify(error.response.data)}`);
                    delay = 60 * 1000;
                    await pendingFlagStatusSyncTokensQueue.add(pendingSyncFlagStatusTokensChunk);
                }
                else {
                    logger_1.logger.error(QUEUE_NAME, `getTokenMetadata error. collectionId:${collectionId}, contract:${contract}, error:${error}`);
                }
            }
        }));
        await (0, exports.addToQueue)(collectionId, contract, delay);
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const getLockName = () => {
    return `${QUEUE_NAME}-lock`;
};
exports.getLockName = getLockName;
const addToQueue = async (collectionId, contract, delay = 0) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { collectionId, contract }, { delay });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=sync-queue.js.map