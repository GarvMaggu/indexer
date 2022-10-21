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
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const updateNftBalanceFloorAskPriceQueue = __importStar(require("@/jobs/nft-balance-updates/update-floor-ask-price-queue"));
const QUEUE_NAME = "nft-balance-updates-backfill-floor-ask-price-queue";
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
        let cursor = job.data.cursor;
        let continuationFilter = "";
        const limit = (await redis_1.redis.get(`${QUEUE_NAME}-limit`)) || 200;
        if (!cursor) {
            const cursorJson = await redis_1.redis.get(`${QUEUE_NAME}-next-cursor`);
            if (cursorJson) {
                cursor = JSON.parse(cursorJson);
            }
        }
        if (cursor) {
            continuationFilter = `AND (o.created_at, o.id) < (to_timestamp($/createdAt/), $/id/)`;
        }
        const sellOrders = await db_1.idb.manyOrNone(`
          SELECT
            o.id,
            o.maker,
            o.token_set_id,
            extract(epoch from o.created_at) created_at
          FROM orders o 
          WHERE o.side = 'sell'
          AND o.fillability_status = 'fillable'
          AND o.approval_status = 'approved'
          ${continuationFilter}
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT $/limit/;
          `, {
            createdAt: cursor === null || cursor === void 0 ? void 0 : cursor.createdAt,
            id: cursor === null || cursor === void 0 ? void 0 : cursor.id,
            limit,
        });
        if (sellOrders.length > 0) {
            const updateFloorAskPriceInfos = [];
            for (const sellOrder of sellOrders) {
                const [, contract, tokenId] = sellOrder.token_set_id.split(":");
                updateFloorAskPriceInfos.push({
                    contract: contract,
                    tokenId: tokenId,
                    owner: (0, utils_1.fromBuffer)(sellOrder.maker),
                });
            }
            await updateNftBalanceFloorAskPriceQueue.addToQueue(updateFloorAskPriceInfos);
            if (sellOrders.length == limit) {
                const lastSellOrder = lodash_1.default.last(sellOrders);
                const nextCursor = {
                    id: lastSellOrder.id,
                    createdAt: lastSellOrder.created_at,
                };
                await redis_1.redis.set(`${QUEUE_NAME}-next-cursor`, JSON.stringify(nextCursor));
                await (0, exports.addToQueue)(nextCursor);
            }
        }
        logger_1.logger.info(QUEUE_NAME, `Processed ${sellOrders.length} sell orders.  limit=${limit}, cursor=${JSON.stringify(cursor)}`);
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue();
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (cursor) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { cursor }, { delay: 2000 });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-floor-ask-price-queue.js.map