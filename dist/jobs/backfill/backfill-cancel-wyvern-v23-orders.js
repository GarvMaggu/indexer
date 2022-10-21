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
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const QUEUE_NAME = "backfill-cancel-wyvern-v23-orders";
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
        const { id } = job.data;
        const limit = 500;
        const results = await db_1.idb.manyOrNone(`
          WITH
            x AS (
              SELECT
                orders.id,
                orders.fillability_status
              FROM orders
              WHERE orders.kind = 'wyvern-v2.3'
                AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                AND orders.id > $/id/
              ORDER BY orders.id
              LIMIT $/limit/
            ),
            y AS (
              UPDATE orders SET
                fillability_status = 'cancelled'
              FROM x
              WHERE orders.id = x.id
            )
          SELECT * FROM x
        `, {
            id,
            limit,
        });
        await orderUpdatesById.addToQueue(results
            .filter(({ fillability_status }) => fillability_status === "fillable")
            .map(({ id }) => ({
            context: `cancelled-${id}`,
            id,
            trigger: {
                kind: "cancel",
            },
        })));
        if (results.length >= limit) {
            const lastResult = results[results.length - 1];
            await (0, exports.addToQueue)(lastResult.id);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock-3`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue(HashZero);
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (id) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { id });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-cancel-wyvern-v23-orders.js.map