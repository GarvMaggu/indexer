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
exports.addToQueue = exports.getRateLimitLockName = exports.getLockName = exports.queue = void 0;
const lodash_1 = __importDefault(require("lodash"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const pending_refresh_tokens_1 = require("@/models/pending-refresh-tokens");
const metadataIndexWrite = __importStar(require("@/jobs/metadata-index/write-queue"));
const metadata_api_1 = __importDefault(require("@/utils/metadata-api"));
const QUEUE_NAME = "metadata-index-process-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "fixed",
            delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
        timeout: 60 * 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        var _a;
        const { method } = job.data;
        let useMetadataApiBaseUrlAlt = false;
        const rateLimitExpiresIn = await (0, redis_1.getLockExpiration)((0, exports.getRateLimitLockName)(method));
        if (rateLimitExpiresIn > 0) {
            logger_1.logger.info(QUEUE_NAME, `Rate Limited. rateLimitExpiresIn: ${rateLimitExpiresIn}`);
            useMetadataApiBaseUrlAlt = true;
        }
        const count = method == "soundxyz" ? 10 : 20;
        // Get the tokens from the list
        const pendingRefreshTokens = new pending_refresh_tokens_1.PendingRefreshTokens(method);
        const refreshTokens = await pendingRefreshTokens.get(count);
        const tokens = [];
        // If no more tokens
        if (lodash_1.default.isEmpty(refreshTokens)) {
            return;
        }
        // Build the query string for each token
        for (const refreshToken of refreshTokens) {
            tokens.push({
                contract: refreshToken.contract,
                tokenId: refreshToken.tokenId,
            });
        }
        let metadata;
        try {
            metadata = await metadata_api_1.default.getTokensMetadata(tokens, useMetadataApiBaseUrlAlt, method);
        }
        catch (error) {
            if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
                logger_1.logger.info(QUEUE_NAME, `Too Many Requests. useMetadataApiBaseUrlAlt=${useMetadataApiBaseUrlAlt}, error: ${JSON.stringify(error.response.data)}`);
                await pendingRefreshTokens.add(refreshTokens, true);
                if (!useMetadataApiBaseUrlAlt) {
                    await (0, redis_1.acquireLock)((0, exports.getRateLimitLockName)(method), 5);
                    if (await (0, redis_1.extendLock)((0, exports.getLockName)(method), 60 * 5)) {
                        await (0, exports.addToQueue)(method);
                    }
                }
                else {
                    await (0, redis_1.releaseLock)((0, exports.getLockName)(method));
                }
                return;
            }
            throw error;
        }
        await metadataIndexWrite.addToQueue(metadata.map((m) => ({
            ...m,
        })));
        // If there are potentially more tokens to process trigger another job
        if (lodash_1.default.size(refreshTokens) == count) {
            if (await (0, redis_1.extendLock)((0, exports.getLockName)(method), 60 * 5)) {
                await (0, exports.addToQueue)(method);
            }
        }
        else {
            await (0, redis_1.releaseLock)((0, exports.getLockName)(method));
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 2 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const getLockName = (method) => {
    return `${QUEUE_NAME}:${method}`;
};
exports.getLockName = getLockName;
const getRateLimitLockName = (method) => {
    return `${QUEUE_NAME}:rate-limit:${method}`;
};
exports.getRateLimitLockName = getRateLimitLockName;
const addToQueue = async (method, delay = 0) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { method }, { delay });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=process-queue.js.map