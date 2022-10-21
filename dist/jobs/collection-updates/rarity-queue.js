"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const rarity_1 = require("@/utils/rarity");
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const collections_1 = require("@/models/collections");
const utils_1 = require("@/common/utils");
const attribute_keys_1 = require("@/models/attribute-keys");
const QUEUE_NAME = "rarity-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: true,
        removeOnFail: 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { collectionId } = job.data;
        const collection = await collections_1.Collections.getById(collectionId, true);
        // If no collection found
        if (lodash_1.default.isNull(collection)) {
            logger_1.logger.error(QUEUE_NAME, `Collection ${collectionId} not fund`);
            return;
        }
        // If the collection is too big
        if (collection.tokenCount > 30000) {
            logger_1.logger.error(QUEUE_NAME, `Collection ${collectionId} has too many tokens (${collection.tokenCount})`);
            return;
        }
        const keysCount = await attribute_keys_1.AttributeKeys.getKeysCount(collectionId);
        if (keysCount > 100) {
            logger_1.logger.error(QUEUE_NAME, `Collection ${collectionId} has too many keys (${keysCount})`);
            return;
        }
        const tokensRarity = await rarity_1.Rarity.getCollectionTokensRarity(collectionId);
        const tokensRarityChunks = lodash_1.default.chunk(tokensRarity, 500);
        // Update the tokens rarity
        for (const tokens of tokensRarityChunks) {
            let updateTokensString = "";
            const replacementParams = {
                contract: (0, utils_1.toBuffer)(collection.contract),
            };
            lodash_1.default.forEach(tokens, (token) => {
                updateTokensString += `(${token.id}, ${token.rarityTraitSum}, ${token.rarityTraitSumRank}),`;
            });
            updateTokensString = lodash_1.default.trimEnd(updateTokensString, ",");
            if (updateTokensString !== "") {
                const updateQuery = `UPDATE tokens
                               SET rarity_score = x.rarityTraitSum, rarity_rank = x.rarityTraitSumRank
                               FROM (VALUES ${updateTokensString}) AS x(tokenId, rarityTraitSum, rarityTraitSumRank)
                               WHERE contract = $/contract/
                               AND token_id = x.tokenId`;
                await db_1.idb.none(updateQuery, replacementParams);
            }
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (collectionId, delay = 60 * 60 * 1000) => {
    if (lodash_1.default.isArray(collectionId)) {
        await exports.queue.addBulk(lodash_1.default.map(collectionId, (id) => ({
            name: (0, crypto_1.randomUUID)(),
            data: { collectionId: id },
            opts: { delay, jobId: id },
        })));
    }
    else {
        await exports.queue.add((0, crypto_1.randomUUID)(), { collectionId }, { delay, jobId: collectionId });
    }
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=rarity-queue.js.map