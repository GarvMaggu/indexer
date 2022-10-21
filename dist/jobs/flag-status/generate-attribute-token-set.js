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
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const collections_1 = require("@/models/collections");
const merkle_1 = require("@reservoir0x/sdk/dist/common/helpers/merkle");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const utils_1 = require("@/orderbook/orders/utils");
const attributes_1 = require("@/models/attributes");
const db_1 = require("@/common/db");
const lodash_1 = __importDefault(require("lodash"));
const QUEUE_NAME = "flag-status-generate-attribute-token-set";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 100,
        removeOnFail: 100,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { attributeId } = job.data;
        const attribute = await attributes_1.Attributes.getById(attributeId);
        if (!attribute) {
            logger_1.logger.warn(QUEUE_NAME, `Missing attribute. attributeId=${attributeId}`);
        }
        if (!(attribute === null || attribute === void 0 ? void 0 : attribute.collectionId)) {
            logger_1.logger.warn(QUEUE_NAME, `No collection for attribute. attributeId=${attributeId}`);
        }
        const collection = await collections_1.Collections.getById(attribute.collectionId);
        if (!collection || collection.tokenCount > index_1.config.maxTokenSetSize) {
            return;
        }
        const tokens = await getAttributeTokens(attributeId);
        const flaggedTokens = tokens.filter((r) => r.isFlagged);
        if (flaggedTokens.length === 0) {
            logger_1.logger.info(QUEUE_NAME, `No Flagged tokens. contract=${collection.contract}, collectionId=${collection.id}, attributeId=${attributeId}`);
            return;
        }
        const nonFlaggedTokensIds = tokens.filter((r) => !r.isFlagged).map((r) => r.tokenId);
        if (nonFlaggedTokensIds.length === 0) {
            logger_1.logger.info(QUEUE_NAME, `No Non Flagged tokens. contract=${collection.contract}, collectionId=${collection.id}, attributeId=${attributeId}`);
            return;
        }
        const merkleTree = (0, merkle_1.generateMerkleTree)(nonFlaggedTokensIds);
        const tokenSetId = `list:${collection.contract}:${merkleTree.getHexRoot()}`;
        const schema = {
            kind: "attribute",
            data: {
                collection: collection.id,
                isNonFlagged: true,
                attributes: [
                    {
                        key: attribute.key,
                        value: attribute.value,
                    },
                ],
            },
        };
        // Create new token set for non flagged tokens
        const ts = await tokenSet.tokenList.save([
            {
                id: tokenSetId,
                schema,
                schemaHash: (0, utils_1.generateSchemaHash)(schema),
                items: {
                    contract: collection.contract,
                    tokenIds: nonFlaggedTokensIds,
                },
            },
        ]);
        if (ts.length !== 1) {
            logger_1.logger.warn(QUEUE_NAME, `Invalid Token Set. contract=${collection.contract}, collectionId=${collection.id}, attributeId=${attributeId}, tokenSetId=${tokenSetId}`);
        }
        else {
            logger_1.logger.info(QUEUE_NAME, `Generated New Non Flagged TokenSet. contract=${collection.contract}, collectionId=${collection.id}, attributeId=${attributeId}, tokenSetId=${tokenSetId}`);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const getAttributeTokens = async (attributeId) => {
    const limit = 5000;
    let checkForMore = true;
    let continuation = "";
    let tokens = [];
    while (checkForMore) {
        const query = `
            SELECT token_attributes.token_id, tokens.is_flagged
            FROM token_attributes
            JOIN tokens ON tokens.contract = token_attributes.contract AND tokens.token_id = token_attributes.token_id
            WHERE attribute_id = $/attributeId/
            ${continuation}
            ORDER BY token_attributes.token_id ASC
            LIMIT ${limit}
      `;
        const result = await db_1.redb.manyOrNone(query, {
            attributeId,
        });
        if (!lodash_1.default.isEmpty(result)) {
            tokens = lodash_1.default.concat(tokens, lodash_1.default.map(result, (r) => ({
                tokenId: r.token_id,
                isFlagged: r.is_flagged,
            })));
            continuation = `AND token_attributes.token_id > ${lodash_1.default.last(result).token_id}`;
        }
        if (limit > lodash_1.default.size(result)) {
            checkForMore = false;
        }
    }
    return tokens;
};
const addToQueue = async (attributeIds) => {
    await exports.queue.addBulk(attributeIds.map((attributeId) => ({
        name: (0, crypto_1.randomUUID)(),
        data: { attributeId },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=generate-attribute-token-set.js.map