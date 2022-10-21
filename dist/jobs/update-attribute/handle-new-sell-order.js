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
exports.addToQueue = exports.queue = void 0;
const lodash_1 = __importDefault(require("lodash"));
const crypto_1 = require("crypto");
const bullmq_1 = require("bullmq");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const logger_1 = require("@/common/logger");
const attributes_1 = require("@/models/attributes");
const tokens_1 = require("@/models/tokens");
const resyncAttributeCache = __importStar(require("@/jobs/update-attribute/resync-attribute-cache"));
const QUEUE_NAME = "handle-new-sell-order-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 100,
        removeOnFail: 10000,
        timeout: 60 * 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { contract, tokenId, price, previousPrice } = job.data;
        const tokenAttributes = await tokens_1.Tokens.getTokenAttributes(contract, tokenId);
        if (lodash_1.default.isEmpty(tokenAttributes)) {
            logger_1.logger.info(QUEUE_NAME, `No attributes found for contract = ${contract}, tokenId = ${tokenId}`);
            return;
        }
        const tokenAttributesIds = lodash_1.default.map(tokenAttributes, (tokenAttribute) => tokenAttribute.attributeId);
        // If this is a new sale
        if (lodash_1.default.isNull(previousPrice) && !lodash_1.default.isNull(price)) {
            await attributes_1.Attributes.incrementOnSaleCount(tokenAttributesIds, 1);
            await resyncAttributeCache.addToQueue(contract, tokenId);
        }
        // The sale ended
        if (!lodash_1.default.isNull(previousPrice) && lodash_1.default.isNull(price)) {
            await attributes_1.Attributes.incrementOnSaleCount(tokenAttributesIds, -1);
            await resyncAttributeCache.addToQueue(contract, tokenId);
            // Recalculate sell floor price for all relevant attributes
            for (const tokenAttribute of tokenAttributes) {
                const { floorSellValue, onSaleCount } = await tokens_1.Tokens.getSellFloorValueAndOnSaleCount(tokenAttribute.collectionId, tokenAttribute.key, tokenAttribute.value);
                await attributes_1.Attributes.update(tokenAttribute.attributeId, {
                    floorSellValue,
                    onSaleCount,
                    sellUpdatedAt: new Date().toISOString(),
                });
            }
        }
        // Check for new sell floor price
        if (!lodash_1.default.isNull(price)) {
            // Check for new sell floor price
            for (const tokenAttribute of tokenAttributes) {
                if (lodash_1.default.isNull(tokenAttribute.floorSellValue) ||
                    Number(price) < Number(tokenAttribute.floorSellValue)) {
                    await attributes_1.Attributes.update(tokenAttribute.attributeId, {
                        floorSellValue: price,
                        sellUpdatedAt: new Date().toISOString(),
                    });
                    logger_1.logger.info(QUEUE_NAME, `Old price=${tokenAttribute.floorSellValue}, New price=${price}, key=${tokenAttribute.key}, value=${tokenAttribute.value}, id=${tokenAttribute.attributeId}`);
                }
            }
        }
    }, {
        connection: redis_1.redis.duplicate(),
        concurrency: 6,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (params) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), params);
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=handle-new-sell-order.js.map