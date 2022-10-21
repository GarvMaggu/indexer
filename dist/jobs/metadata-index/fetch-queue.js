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
exports.addToQueue = exports.getIndexingMethod = exports.queue = void 0;
const constants_1 = require("@ethersproject/constants");
const lodash_1 = __importDefault(require("lodash"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const pending_refresh_tokens_1 = require("@/models/pending-refresh-tokens");
const metadataIndexProcess = __importStar(require("@/jobs/metadata-index/process-queue"));
const QUEUE_NAME = "metadata-index-fetch-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 20000,
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
        // Do nothing if the indexer is running in liquidity-only mode
        if (index_1.config.liquidityOnly) {
            return;
        }
        const { kind, data } = job.data;
        const prioritized = !lodash_1.default.isUndefined(job.opts.priority);
        const limit = 1000;
        let refreshTokens = [];
        if (kind === "full-collection") {
            // Get batch of tokens for the collection
            const [contract, tokenId] = data.continuation
                ? data.continuation.split(":")
                : [constants_1.AddressZero, "0"];
            refreshTokens = await getTokensForCollection(data.collection, contract, tokenId, limit);
            // If no more tokens found
            if (lodash_1.default.isEmpty(refreshTokens)) {
                logger_1.logger.warn(QUEUE_NAME, `No more tokens found for collection: ${data.collection}`);
                return;
            }
            // If there are potentially more tokens to refresh
            if (lodash_1.default.size(refreshTokens) == limit) {
                const lastToken = refreshTokens[limit - 1];
                const continuation = `${lastToken.contract}:${lastToken.tokenId}`;
                logger_1.logger.info(QUEUE_NAME, `Trigger token sync continuation: ${continuation}`);
                await (0, exports.addToQueue)([
                    {
                        kind,
                        data: {
                            ...data,
                            continuation,
                        },
                    },
                ], prioritized);
            }
        }
        else if (kind === "single-token") {
            // Create the single token from the params
            refreshTokens.push({
                collection: data.collection,
                contract: data.contract,
                tokenId: data.tokenId,
            });
        }
        // Add the tokens to the list
        const pendingRefreshTokens = new pending_refresh_tokens_1.PendingRefreshTokens(data.method);
        const pendingCount = await pendingRefreshTokens.add(refreshTokens, prioritized);
        logger_1.logger.info(QUEUE_NAME, `There are ${pendingCount} tokens pending to refresh for ${data.method}`);
        if (await (0, redis_1.acquireLock)(metadataIndexProcess.getLockName(data.method), 60 * 5)) {
            // Trigger a job to process the queue
            await metadataIndexProcess.addToQueue(data.method);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 5 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
async function getTokensForCollection(collection, contract, tokenId, limit) {
    const tokens = await db_1.redb.manyOrNone(`SELECT tokens.contract, tokens.token_id
            FROM tokens
            WHERE tokens.collection_id = $/collection/
            AND (tokens.contract, tokens.token_id) > ($/contract/, $/tokenId/)
            LIMIT ${limit}`, {
        collection: collection,
        contract: (0, utils_1.toBuffer)(contract),
        tokenId: tokenId,
    });
    return tokens.map((t) => {
        return { collection, contract: (0, utils_1.fromBuffer)(t.contract), tokenId: t.token_id };
    });
}
function getIndexingMethod(community) {
    switch (community) {
        case "sound.xyz":
            return "soundxyz";
    }
    return index_1.config.metadataIndexingMethod;
}
exports.getIndexingMethod = getIndexingMethod;
const addToQueue = async (metadataIndexInfos, prioritized = false, delayInSeconds = 0) => {
    await exports.queue.addBulk(metadataIndexInfos.map((metadataIndexInfo) => ({
        name: (0, crypto_1.randomUUID)(),
        data: metadataIndexInfo,
        opts: {
            priority: prioritized ? 1 : undefined,
            delay: delayInSeconds * 1000,
        },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=fetch-queue.js.map