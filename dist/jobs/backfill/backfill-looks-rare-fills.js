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
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const syncEventsUtils = __importStar(require("@/events-sync/utils"));
const QUEUE_NAME = "backfill-looks-rare-fills";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 20000,
        },
        removeOnComplete: 10000,
        removeOnFail: 10000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { block, txHash } = job.data;
        const limit = 500;
        const result = await db_1.idb.manyOrNone(`
          SELECT
            fill_events_2.block,
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index,
            fill_events_2.order_side
          FROM fill_events_2
          WHERE (fill_events_2.block, fill_events_2.tx_hash) < ($/block/, $/txHash/)
            AND fill_events_2.order_kind = 'looks-rare'
          ORDER BY
            fill_events_2.block DESC,
            fill_events_2.tx_hash DESC
          LIMIT $/limit/
        `, { limit, block, txHash: (0, utils_1.toBuffer)(txHash) });
        const values = [];
        const columns = new db_1.pgp.helpers.ColumnSet(["tx_hash", "log_index", "batch_index", "order_side"], {
            table: "fill_events_2",
        });
        for (const { tx_hash, log_index, batch_index, order_side } of result) {
            const tx = await syncEventsUtils.fetchTransaction((0, utils_1.fromBuffer)(tx_hash));
            // Fill any wrong "buy" fill events
            if (order_side === "buy" && tx.value !== "0") {
                values.push({
                    tx_hash,
                    log_index,
                    batch_index,
                    order_side: "sell",
                });
            }
        }
        if (values.length) {
            await db_1.idb.none(`
            UPDATE fill_events_2 SET
              order_side = x.order_side::order_side_t
            FROM (
              VALUES ${db_1.pgp.helpers.values(values, columns)}
            ) AS x(tx_hash, log_index, batch_index, order_side)
            WHERE fill_events_2.tx_hash = x.tx_hash::BYTEA
              AND fill_events_2.log_index = x.log_index::INT
              AND fill_events_2.batch_index = x.batch_index::INT
          `);
        }
        if (result.length >= limit) {
            const lastResult = result[result.length - 1];
            await (0, exports.addToQueue)(lastResult.block, (0, utils_1.fromBuffer)(lastResult.tx_hash));
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // if (config.chainId === 1) {
    //   redlock
    //     .acquire([`${QUEUE_NAME}-lock-3`], 60 * 60 * 24 * 30 * 1000)
    //     .then(async () => {
    //       await addToQueue(14860000, HashZero);
    //     })
    //     .catch(() => {
    //       // Skip on any errors
    //     });
    // }
}
const addToQueue = async (block, txHash) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { block, txHash });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-looks-rare-fills.js.map