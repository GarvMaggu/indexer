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
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const collections_1 = require("@/models/collections");
const merkle_1 = require("@reservoir0x/sdk/dist/common/helpers/merkle");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const utils_1 = require("@/orderbook/orders/utils");
const db_1 = require("@/common/db");
const ordersUpdateById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const flagStatusGenerateAttributeTokenSet = __importStar(require("@/jobs/flag-status/generate-attribute-token-set"));
const utils_2 = require("@/common/utils");
const constants_1 = require("@ethersproject/constants");
const QUEUE_NAME = "flag-status-generate-collection-token-set";
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
        const { contract, collectionId } = job.data;
        const collection = await collections_1.Collections.getById(collectionId);
        if (!collection || collection.tokenCount > index_1.config.maxTokenSetSize) {
            return;
        }
        const tokens = await getCollectionTokens(collectionId);
        const flaggedTokens = tokens.filter((r) => r.isFlagged);
        if (flaggedTokens.length === 0) {
            logger_1.logger.info(QUEUE_NAME, `No Flagged tokens. contract=${contract}, collectionId=${collectionId}`);
            if (collection.nonFlaggedTokenSetId) {
                logger_1.logger.info(QUEUE_NAME, `Removed Non Flagged TokenSet from collection. contract=${contract}, collectionId=${collectionId}, tokenSetId=${collection.tokenSetId}, nonFlaggedTokenSetId=${collection.nonFlaggedTokenSetId}`);
                await collections_1.Collections.update(collectionId, { nonFlaggedTokenSetId: null });
            }
            return;
        }
        const nonFlaggedTokensIds = tokens.filter((r) => !r.isFlagged).map((r) => r.tokenId);
        const merkleTree = (0, merkle_1.generateMerkleTree)(nonFlaggedTokensIds);
        const tokenSetId = `list:${contract}:${merkleTree.getHexRoot()}`;
        if (tokenSetId != collection.nonFlaggedTokenSetId) {
            const schema = {
                kind: "collection-non-flagged",
                data: {
                    collection: collection.id,
                },
            };
            const schemaHash = (0, utils_1.generateSchemaHash)(schema);
            // Create new token set for non flagged tokens
            const ts = await tokenSet.tokenList.save([
                {
                    id: tokenSetId,
                    schema,
                    schemaHash,
                    items: {
                        contract,
                        tokenIds: nonFlaggedTokensIds,
                    },
                },
            ]);
            if (ts.length !== 1) {
                logger_1.logger.warn(QUEUE_NAME, `Invalid Token Set. contract=${contract}, collectionId=${collectionId}, generatedNonFlaggedTokenSetId=${tokenSetId}`);
            }
            else {
                logger_1.logger.info(QUEUE_NAME, `Generated New Non Flagged TokenSet. contract=${contract}, collectionId=${collectionId}, tokenSetId=${collection.tokenSetId}, nonFlaggedTokenSetId=${collection.nonFlaggedTokenSetId}, generatedNonFlaggedTokenSetId=${tokenSetId}, flaggedTokenCount=${flaggedTokens.length}`);
                // Set the new non flagged tokens token set
                await collections_1.Collections.update(collectionId, { nonFlaggedTokenSetId: tokenSetId });
                await handleAttributes(contract, collectionId, flaggedTokens.map((r) => r.tokenId));
                await handleOrders(contract, collectionId, tokenSetId, schemaHash);
            }
        }
        else {
            logger_1.logger.info(QUEUE_NAME, `Non Flagged TokenSet Already Exists. contract=${contract}, collectionId=${collectionId}, tokenSetId=${collection.tokenSetId}, nonFlaggedTokenSetId=${collection.nonFlaggedTokenSetId}, generatedNonFlaggedTokenSetId=${tokenSetId}`);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const getCollectionTokens = async (collectionId) => {
    const limit = 5000;
    let checkForMore = true;
    let continuation = "";
    let tokens = [];
    while (checkForMore) {
        const query = `
        SELECT token_id, is_flagged
        FROM tokens
        WHERE collection_id = $/collectionId/
        ${continuation}
        ORDER BY token_id ASC
        LIMIT ${limit}
      `;
        const result = await db_1.redb.manyOrNone(query, {
            collectionId,
        });
        if (!lodash_1.default.isEmpty(result)) {
            tokens = lodash_1.default.concat(tokens, lodash_1.default.map(result, (r) => ({
                tokenId: r.token_id,
                isFlagged: r.is_flagged,
            })));
            continuation = `AND token_id > ${lodash_1.default.last(result).token_id}`;
        }
        if (limit > lodash_1.default.size(result)) {
            checkForMore = false;
        }
    }
    return tokens;
};
const handleOrders = async (contract, collectionId, tokenSetId, tokenSetSchemaHash) => {
    // Trigger new order flow for valid orders.
    const orders = await db_1.idb.manyOrNone(`
                UPDATE orders
                SET token_set_schema_hash = $/tokenSetSchemaHash/
                WHERE orders.side = 'buy'
                AND orders.fillability_status = 'fillable'
                AND orders.approval_status = 'approved'
                AND orders.token_set_id = $/tokenSetId/
                AND orders.token_set_schema_hash = $/defaultSchemaHash/
                RETURNING orders.id
              `, {
        tokenSetId,
        tokenSetSchemaHash: (0, utils_2.toBuffer)(tokenSetSchemaHash),
        defaultSchemaHash: (0, utils_2.toBuffer)(constants_1.HashZero),
    });
    if (orders === null || orders === void 0 ? void 0 : orders.length) {
        logger_1.logger.info(QUEUE_NAME, `Orders Found!. contract=${contract}, collectionId=${collectionId}, tokenSetId=${tokenSetId}, tokenSetSchemaHash=${tokenSetSchemaHash}, orders=${orders.length}`);
        await ordersUpdateById.addToQueue(orders.map(({ id }) => ({
            context: `new-order-${id}`,
            id,
            trigger: {
                kind: "new-order",
            },
        })));
    }
};
const handleAttributes = async (contract, collectionId, flaggedTokenIds) => {
    // Calculate non flagged token set for related attributes
    const attributes = await db_1.redb.manyOrNone(`
            SELECT DISTINCT token_attributes.attribute_id
            FROM token_attributes
            WHERE token_attributes.collection_id = $/collectionId/      
            AND token_attributes.token_id IN ($/flaggedTokenIds:list/)   
          `, {
        collectionId,
        flaggedTokenIds,
    });
    if (attributes === null || attributes === void 0 ? void 0 : attributes.length) {
        logger_1.logger.info(QUEUE_NAME, `Attributes Found!. contract=${contract}, collectionId=${collectionId}, attributes=${attributes.length}`);
        await flagStatusGenerateAttributeTokenSet.addToQueue(attributes.map(({ attribute_id }) => attribute_id));
    }
};
const addToQueue = async (contract, collectionId) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { contract, collectionId });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=generate-collection-token-set.js.map