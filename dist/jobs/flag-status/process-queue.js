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
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const collections_1 = require("@/models/collections");
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const pending_flag_status_sync_tokens_1 = require("@/models/pending-flag-status-sync-tokens");
const flagStatusSyncJob = __importStar(require("@/jobs/flag-status/sync-queue"));
const lodash_1 = __importDefault(require("lodash"));
const pending_flag_status_sync_jobs_1 = require("@/models/pending-flag-status-sync-jobs");
const crypto_1 = require("crypto");
const QUEUE_NAME = "flag-status-process-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 1000,
        removeOnFail: 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
const LOWEST_FLOOR_ASK_QUERY_LIMIT = 20;
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async () => {
        const pendingFlagStatusSyncJobs = new pending_flag_status_sync_jobs_1.PendingFlagStatusSyncJobs();
        if (await (0, redis_1.acquireLock)(flagStatusSyncJob.getLockName())) {
            logger_1.logger.info(QUEUE_NAME, `Lock acquired.`);
            const pendingJob = await pendingFlagStatusSyncJobs.next();
            if (pendingJob) {
                const { kind, data } = pendingJob;
                logger_1.logger.info(QUEUE_NAME, `Processing job. kind=${kind}, data=${JSON.stringify(data)}`);
                if (kind === "collection") {
                    const { collectionId, backfill } = data;
                    const collection = await collections_1.Collections.getById(collectionId);
                    // Don't check collections with too many tokens
                    if (!collection || collection.tokenCount > index_1.config.maxTokenSetSize) {
                        await (0, redis_1.releaseLock)(flagStatusSyncJob.getLockName());
                        return;
                    }
                    const pendingFlagStatusSyncTokens = await getPendingFlagStatusSyncTokens(collectionId, backfill);
                    const pendingFlagStatusSyncTokensQueue = new pending_flag_status_sync_tokens_1.PendingFlagStatusSyncTokens(collectionId);
                    const pendingCount = await pendingFlagStatusSyncTokensQueue.add(pendingFlagStatusSyncTokens.map((r) => ({
                        collectionId: collectionId,
                        contract: collection.contract,
                        tokenId: r.tokenId,
                        isFlagged: r.isFlagged,
                    })));
                    logger_1.logger.info(QUEUE_NAME, `There are ${pendingCount} tokens pending flag status sync for ${collectionId}`);
                    await flagStatusSyncJob.addToQueue(collectionId, collection.contract);
                }
                else if (kind === "tokens") {
                    const { collectionId, contract, tokens } = data;
                    const pendingFlagStatusSyncTokensQueue = new pending_flag_status_sync_tokens_1.PendingFlagStatusSyncTokens(collectionId);
                    await pendingFlagStatusSyncTokensQueue.add(tokens.map((token) => ({
                        collectionId: collectionId,
                        contract: contract,
                        tokenId: token.tokenId,
                        isFlagged: token.tokenIsFlagged,
                    })));
                    await flagStatusSyncJob.addToQueue(collectionId, contract);
                }
            }
            else {
                logger_1.logger.info(QUEUE_NAME, `Lock released.`);
                await (0, redis_1.releaseLock)(flagStatusSyncJob.getLockName());
            }
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const getPendingFlagStatusSyncTokens = async (collectionId, backfill = false) => {
    const pendingSyncFlagStatusTokens = [];
    if (backfill) {
        const tokensQuery = `
            SELECT token_id, is_flagged
            FROM tokens
            WHERE collection_id = $/collectionId/
        `;
        const tokens = await db_1.idb.manyOrNone(tokensQuery, {
            collectionId,
        });
        pendingSyncFlagStatusTokens.push(...tokens.map((r) => ({
            tokenId: r.token_id,
            isFlagged: r.is_flagged,
        })));
    }
    else {
        const flaggedTokens = await getFlaggedTokens(collectionId);
        pendingSyncFlagStatusTokens.push(...flaggedTokens.map((r) => ({
            tokenId: r.token_id,
            isFlagged: 1,
        })));
        const lowestFloorAskTokens = await getLowestFloorAskTokens(collectionId);
        pendingSyncFlagStatusTokens.push(...lowestFloorAskTokens.map((r) => ({
            tokenId: r.token_id,
            isFlagged: 0,
        })));
        const recentTransferredTokens = await getRecentTransferredTokens(collectionId);
        pendingSyncFlagStatusTokens.push(...recentTransferredTokens.map((r) => ({
            tokenId: r.token_id,
            isFlagged: 0,
        })));
    }
    return lodash_1.default.uniqBy(pendingSyncFlagStatusTokens, "tokenId");
};
const getFlaggedTokens = async (collectionId) => {
    const flaggedTokensQuery = `
            SELECT token_id
            FROM tokens
            WHERE collection_id = $/collectionId/
            AND is_flagged = 1
        `;
    return await db_1.idb.manyOrNone(flaggedTokensQuery, {
        collectionId,
    });
};
const getLowestFloorAskTokens = async (collectionId) => {
    const lowestFloorAskQuery = `
            SELECT token_id
            FROM tokens
            WHERE collection_id = $/collectionId/
            AND floor_sell_value IS NOT NULL
            AND is_flagged = 0
            ORDER BY floor_sell_value ASC
            LIMIT $/limit/
        `;
    return await db_1.idb.manyOrNone(lowestFloorAskQuery, {
        collectionId,
        limit: LOWEST_FLOOR_ASK_QUERY_LIMIT,
    });
};
const getRecentTransferredTokens = async (collectionId) => {
    let tokensRangeFilter = "";
    const values = {};
    if (collectionId.match(/^0x[a-f0-9]{40}:\d+:\d+$/g)) {
        const [contract, startTokenId, endTokenId] = collectionId.split(":");
        values.contract = (0, utils_1.toBuffer)(contract);
        values.startTokenId = startTokenId;
        values.endTokenId = endTokenId;
        tokensRangeFilter = `
              AND nft_transfer_events.token_id >= $/startTokenId/
              AND nft_transfer_events.token_id <= $/endTokenId/
            `;
    }
    else {
        values.contract = (0, utils_1.toBuffer)(collectionId);
    }
    const recentTransfersQuery = `
            SELECT
                DISTINCT ON (nft_transfer_events.token_id) nft_transfer_events.token_id,
                nft_transfer_events.timestamp
            FROM nft_transfer_events
            JOIN tokens ON nft_transfer_events.address = tokens.contract AND nft_transfer_events.token_id = tokens.token_id
            WHERE nft_transfer_events.address = $/contract/
            ${tokensRangeFilter}
            AND (nft_transfer_events.timestamp > extract(epoch from tokens.last_flag_update) OR tokens.last_flag_update IS NULL)
            AND tokens.is_flagged = 0
            ORDER BY nft_transfer_events.token_id, nft_transfer_events.timestamp DESC
      `;
    return await db_1.idb.manyOrNone(recentTransfersQuery, values);
};
const addToQueue = async () => {
    await exports.queue.add((0, crypto_1.randomUUID)(), {});
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=process-queue.js.map