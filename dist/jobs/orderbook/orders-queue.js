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
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const orders = __importStar(require("@/orderbook/orders"));
const QUEUE_NAME = "orderbook-orders-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 10000,
        },
        removeOnComplete: 10000,
        removeOnFail: 10000,
        timeout: 30000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { kind, info, relayToArweave, validateBidValue } = job.data;
        try {
            switch (kind) {
                case "x2y2": {
                    const result = await orders.x2y2.save([info]);
                    logger_1.logger.info(QUEUE_NAME, `[x2y2] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "foundation": {
                    const result = await orders.foundation.save([info]);
                    logger_1.logger.info(QUEUE_NAME, `[foundation] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "cryptopunks": {
                    const result = await orders.cryptopunks.save([info]);
                    logger_1.logger.info(QUEUE_NAME, `[cryptopunks] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "zora-v3": {
                    const result = await orders.zora.save([info]);
                    logger_1.logger.info(QUEUE_NAME, `[zora-v3] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "looks-rare": {
                    const result = await orders.looksRare.save([info], relayToArweave);
                    logger_1.logger.info(QUEUE_NAME, `[looks-rare] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "seaport": {
                    const result = await orders.seaport.save([info], relayToArweave, validateBidValue);
                    logger_1.logger.info(QUEUE_NAME, `[seaport] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "sudoswap": {
                    const result = await orders.sudoswap.save([info]);
                    logger_1.logger.info(QUEUE_NAME, `[sudoswap] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "zeroex-v4": {
                    const result = await orders.zeroExV4.save([info], relayToArweave);
                    logger_1.logger.info(QUEUE_NAME, `[zeroex-v4] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
                case "universe": {
                    const result = await orders.universe.save([info]);
                    logger_1.logger.info(QUEUE_NAME, `[universe] Order save result: ${JSON.stringify(result)}`);
                    break;
                }
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to process order ${job.data}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 30 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // Every minute we check the size of the orders queue. This will
    // ensure we get notified when it's buffering up and potentially
    // blocking the real-time flow of orders.
    node_cron_1.default.schedule("*/1 * * * *", async () => await redis_1.redlock
        .acquire(["orders-queue-size-check-lock"], (60 - 5) * 1000)
        .then(async () => {
        const size = await exports.queue.count();
        if (size >= 10000) {
            logger_1.logger.error("orders-queue-size-check", `Orders queue buffering up: size=${size}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
}
const addToQueue = async (orderInfos, prioritized = false) => {
    await exports.queue.addBulk(orderInfos.map((orderInfo) => ({
        name: (0, crypto_1.randomUUID)(),
        data: orderInfo,
        opts: {
            priority: prioritized ? 1 : undefined,
        },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=orders-queue.js.map