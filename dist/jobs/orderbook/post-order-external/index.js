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
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const bullmq_1 = require("bullmq");
const crypto = __importStar(require("crypto"));
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const OpenSeaApi = __importStar(require("@/jobs/orderbook/post-order-external/api/opensea"));
const LooksrareApi = __importStar(require("@/jobs/orderbook/post-order-external/api/looksrare"));
const X2Y2Api = __importStar(require("@/jobs/orderbook/post-order-external/api/x2y2"));
const UniverseApi = __importStar(require("@/jobs/orderbook/post-order-external/api/universe"));
const api_rate_limiter_1 = require("@/jobs/orderbook/post-order-external/api-rate-limiter");
const errors_1 = require("@/jobs/orderbook/post-order-external/api/errors");
const db_1 = require("@/common/db");
const QUEUE_NAME = "orderbook-post-order-external-queue";
const MAX_RETRIES = 5;
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 10000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { orderId, orderData, orderbook, retry } = job.data;
        let orderbookApiKey = job.data.orderbookApiKey;
        if (![1, 4, 5].includes(index_1.config.chainId)) {
            throw new Error("Unsupported network");
        }
        if (!["opensea", "looks-rare", "x2y2", "universe"].includes(orderbook)) {
            throw new Error("Unsupported orderbook");
        }
        orderbookApiKey = orderbookApiKey || getOrderbookDefaultApiKey(orderbook);
        const rateLimiter = getRateLimiter(orderbook, orderbookApiKey);
        if (await rateLimiter.reachedLimit()) {
            // If limit reached, reschedule job based on the limit expiration.
            const delay = await rateLimiter.getExpiration();
            logger_1.logger.info(QUEUE_NAME, `Post Order Rate Limited. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, delay: ${delay}, retry: ${retry}`);
            await (0, exports.addToQueue)(orderId, orderData, orderbook, orderbookApiKey, retry, delay, true);
        }
        else {
            try {
                await postOrder(orderbook, orderId, orderData, orderbookApiKey);
                logger_1.logger.info(QUEUE_NAME, `Post Order Success. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, retry: ${retry}`);
            }
            catch (error) {
                if (error instanceof errors_1.RequestWasThrottledError) {
                    // If we got throttled by the api, reschedule job based on the provided delay.
                    const delay = error.delay;
                    await rateLimiter.setExpiration(delay);
                    await (0, exports.addToQueue)(orderId, orderData, orderbook, orderbookApiKey, retry, delay, true);
                    logger_1.logger.info(QUEUE_NAME, `Post Order Throttled. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, delay: ${delay}, retry: ${retry}`);
                }
                else if (error instanceof errors_1.InvalidRequestError) {
                    // If the order is invalid, fail the job.
                    logger_1.logger.error(QUEUE_NAME, `Post Order Failed - Invalid Order. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, retry: ${retry}, error: ${error}`);
                    throw new Error("Post Order Failed - Invalid Order");
                }
                else if (retry < MAX_RETRIES) {
                    // If we got an unknown error from the api, reschedule job based on fixed delay.
                    logger_1.logger.info(QUEUE_NAME, `Post Order Failed - Retrying. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, retry: ${retry}`);
                    await (0, exports.addToQueue)(orderId, orderData, orderbook, orderbookApiKey, ++job.data.retry, 1000, true);
                }
                else {
                    logger_1.logger.error(QUEUE_NAME, `Post Order Failed - Max Retries Reached. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, retry: ${retry}, error: ${error}`);
                    throw new Error("Post Order Failed - Max Retries Reached");
                }
            }
        }
    }, {
        connection: redis_1.redis.duplicate(),
        concurrency: 10,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const getOrderbookDefaultApiKey = (orderbook) => {
    switch (orderbook) {
        case "opensea":
            return index_1.config.openSeaApiKey;
        case "looks-rare":
            return index_1.config.looksRareApiKey;
        case "x2y2":
            return index_1.config.x2y2ApiKey;
        case "universe":
            return "";
    }
    throw new Error(`Unsupported orderbook ${orderbook}`);
};
const getRateLimiter = (orderbook, orderbookApiKey) => {
    switch (orderbook) {
        case "looks-rare":
            return new api_rate_limiter_1.OrderbookApiRateLimiter(orderbook, orderbookApiKey, LooksrareApi.RATE_LIMIT_REQUEST_COUNT, LooksrareApi.RATE_LIMIT_INTERVAL);
        case "opensea":
            return new api_rate_limiter_1.OrderbookApiRateLimiter(orderbook, orderbookApiKey, OpenSeaApi.RATE_LIMIT_REQUEST_COUNT, OpenSeaApi.RATE_LIMIT_INTERVAL);
        case "x2y2":
            return new api_rate_limiter_1.OrderbookApiRateLimiter(orderbook, orderbookApiKey, X2Y2Api.RATE_LIMIT_REQUEST_COUNT, X2Y2Api.RATE_LIMIT_INTERVAL);
        case "universe":
            return new api_rate_limiter_1.OrderbookApiRateLimiter(orderbook, orderbookApiKey, UniverseApi.RATE_LIMIT_REQUEST_COUNT, UniverseApi.RATE_LIMIT_INTERVAL);
    }
    throw new Error(`Unsupported orderbook ${orderbook}`);
};
const postOrder = async (orderbook, orderId, orderData, orderbookApiKey) => {
    var _a, _b, _c;
    switch (orderbook) {
        case "opensea": {
            const order = new Sdk.Seaport.Order(index_1.config.chainId, orderData);
            logger_1.logger.info(QUEUE_NAME, `Post Order Seaport. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, side=${(_a = order.getInfo()) === null || _a === void 0 ? void 0 : _a.side}, kind=${order.params.kind}`);
            if (((_b = order.getInfo()) === null || _b === void 0 ? void 0 : _b.side) === "buy" &&
                ["contract-wide", "token-list"].includes(order.params.kind)) {
                const { collectionSlug } = await db_1.redb.oneOrNone(`
                SELECT c.slug AS "collectionSlug"
                FROM orders o
                JOIN token_sets ts
                  ON o.token_set_id = ts.id
                JOIN collections c   
                  ON c.id = ts.collection_id  
                WHERE o.id = $/orderId/
                AND ts.collection_id IS NOT NULL
                AND ts.attribute_id IS NULL
                LIMIT 1
            `, {
                    orderId: orderId,
                });
                if (!collectionSlug) {
                    throw new Error("Invalid collection offer.");
                }
                const buildCollectionOfferParams = await OpenSeaApi.buildCollectionOffer(order.params.offerer, 1, collectionSlug, orderbookApiKey);
                logger_1.logger.info(QUEUE_NAME, `Post Order Seaport consideration. orderbook: ${orderbook}, orderId=${orderId}, orderData=${JSON.stringify(orderData)}, side=${(_c = order.getInfo()) === null || _c === void 0 ? void 0 : _c.side}, kind=${order.params.kind}, consideration=${JSON.stringify(order.params.consideration[0])}, consideration=${JSON.stringify(buildCollectionOfferParams.partialParameters.consideration[0])}`);
                order.params.consideration[0] =
                    buildCollectionOfferParams.partialParameters.consideration[0];
                return OpenSeaApi.postCollectionOffer(order, collectionSlug, orderbookApiKey);
            }
            return OpenSeaApi.postOrder(order, orderbookApiKey);
        }
        case "looks-rare": {
            const order = new Sdk.LooksRare.Order(index_1.config.chainId, orderData);
            return LooksrareApi.postOrder(order, orderbookApiKey);
        }
        case "universe": {
            const order = new Sdk.Universe.Order(index_1.config.chainId, orderData);
            return UniverseApi.postOrder(order);
        }
        case "x2y2": {
            return X2Y2Api.postOrder(orderData, orderbookApiKey);
        }
    }
    throw new Error(`Unsupported orderbook ${orderbook}`);
};
const addToQueue = async (orderId, orderData, orderbook, orderbookApiKey, retry = 0, delay = 0, prioritized = false) => {
    await exports.queue.add(crypto.randomUUID(), {
        orderId,
        orderData,
        orderbook,
        orderbookApiKey,
        retry,
    }, {
        delay,
        priority: prioritized ? 1 : undefined,
    });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=index.js.map