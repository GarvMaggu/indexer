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
const Sdk = __importStar(require("@reservoir0x/sdk"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const QUEUE_NAME = "backfill-sales-currency-price";
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
        const { createdAt, txHash, logIndex, batchIndex } = job.data;
        const limit = 1000;
        const results = await db_1.idb.manyOrNone(`
          SELECT
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index,
            floor(extract('epoch' from fill_events_2.created_at)) AS created_at,
            fill_events_2.currency,
            fill_events_2.price,
            fill_events_2.currency_price
          FROM fill_events_2
          WHERE (
            fill_events_2.created_at,
            fill_events_2.tx_hash,
            fill_events_2.log_index,
            fill_events_2.batch_index
          ) < (
            to_timestamp($/createdAt/),
            $/txHash/,
            $/logIndex/,
            $/batchIndex/
          )
            AND fill_events_2.created_at > now() - interval '30 days'
          ORDER BY
            fill_events_2.created_at DESC,
            fill_events_2.tx_hash DESC,
            fill_events_2.log_index DESC,
            fill_events_2.batch_index DESC
          LIMIT $/limit/
        `, {
            limit,
            createdAt,
            txHash: (0, utils_1.toBuffer)(txHash),
            logIndex,
            batchIndex,
        });
        const values = [];
        const columns = new db_1.pgp.helpers.ColumnSet(["tx_hash", "log_index", "batch_index", "currency_price"], {
            table: "fill_events_2",
        });
        for (const { tx_hash, log_index, batch_index, currency, currency_price, price } of results) {
            if (!currency_price) {
                if ((0, utils_1.fromBuffer)(currency) === Sdk.Common.Addresses.Eth[index_1.config.chainId] ||
                    (0, utils_1.fromBuffer)(currency) === Sdk.Common.Addresses.Weth[index_1.config.chainId]) {
                    values.push({
                        tx_hash,
                        log_index,
                        batch_index,
                        currency_price: price,
                    });
                }
                else {
                    logger_1.logger.error(QUEUE_NAME, `Transaction ${(0, utils_1.fromBuffer)(tx_hash)} needs a resync`);
                }
            }
        }
        if (values.length) {
            await db_1.idb.none(`
          UPDATE fill_events_2 SET
            currency_price = x.currency_price::NUMERIC(78, 0)
          FROM (
            VALUES ${db_1.pgp.helpers.values(values, columns)}
          ) AS x(tx_hash, log_index, batch_index, currency_price)
          WHERE fill_events_2.tx_hash = x.tx_hash::BYTEA
            AND fill_events_2.log_index = x.log_index::INT
            AND fill_events_2.batch_index = x.batch_index::INT
          `);
        }
        if (results.length >= limit) {
            const lastResult = results[results.length - 1];
            await (0, exports.addToQueue)(lastResult.created_at, (0, utils_1.fromBuffer)(lastResult.tx_hash), lastResult.log_index, lastResult.batch_index);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue(now(), HashZero, 0, 0);
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (createdAt, txHash, logIndex, batchIndex) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { createdAt, txHash, logIndex, batchIndex });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-sales-currency-price.js.map