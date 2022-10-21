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
const lodash_1 = __importDefault(require("lodash"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const resyncAttributeCache = __importStar(require("@/jobs/update-attribute/resync-attribute-cache"));
const utils_1 = require("@/common/utils");
const QUEUE_NAME = "resync-attribute-floor-value-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 10000,
        removeOnFail: 10000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { continuation } = job.data;
        const limit = 500;
        let continuationFilter = "";
        if (continuation != "") {
            continuationFilter = `WHERE id > '${continuation}'`;
        }
        const query = `SELECT id
                     FROM collections
                     ${continuationFilter}
                     ORDER BY id ASC
                     LIMIT ${limit}`;
        const collections = await db_1.redb.manyOrNone(query);
        if (collections) {
            const collectionsIds = lodash_1.default.join(lodash_1.default.map(collections, (collection) => collection.id), "','");
            const tokensQuery = `
            SELECT DISTINCT ON (key, value) key, value, tokens.contract, tokens.token_id
            FROM collections
            JOIN tokens ON collections.contract = tokens.contract
            JOIN token_attributes ON tokens.contract = token_attributes.contract AND token_attributes.token_id = tokens.token_id
            WHERE collections.id IN ('$/collectionsIds:raw/')
            AND tokens.floor_sell_value IS NOT NULL
        `;
            const tokens = await db_1.redb.manyOrNone(tokensQuery, { collectionsIds });
            lodash_1.default.forEach(tokens, (token) => {
                resyncAttributeCache.addToQueue((0, utils_1.fromBuffer)(token.contract), token.token_id, 0);
            });
            job.data.cursor = null;
            if (lodash_1.default.size(collections) == limit) {
                const lastCollection = lodash_1.default.last(collections);
                job.data.cursor = lastCollection.id;
            }
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 3 });
    worker.on("completed", async (job) => {
        if (job.data.cursor) {
            logger_1.logger.info(QUEUE_NAME, `Updated up to lastCollection=${job.data.cursor}`);
            await (0, exports.addToQueue)(job.data.cursor);
        }
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (continuation = "") => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { continuation });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=resync-attribute-floor-sell.js.map