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
const provider_1 = require("@/common/provider");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const syncEventsUtils = __importStar(require("@/events-sync/utils"));
const QUEUE_NAME = "backfill-transaction-block-fields-queue";
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
        const { hash } = job.data;
        const limit = 200;
        const results = await db_1.idb.manyOrNone(`
          SELECT
            transactions.hash,
            transactions.block_timestamp
          FROM transactions
          WHERE transactions.hash < $/hash/
          ORDER BY transactions.hash DESC
          LIMIT $/limit/
        `, {
            limit,
            hash: (0, utils_1.toBuffer)(hash),
        });
        const values = [];
        const columns = new db_1.pgp.helpers.ColumnSet(["hash", "block_number", "block_timestamp"], {
            table: "transactions",
        });
        for (const { hash, block_timestamp } of results) {
            if (!block_timestamp) {
                const tx = await provider_1.baseProvider.getTransaction((0, utils_1.fromBuffer)(hash));
                if (tx) {
                    values.push({
                        hash,
                        block_number: tx.blockNumber,
                        block_timestamp: (await syncEventsUtils.fetchBlock(tx.blockNumber)).timestamp,
                    });
                }
            }
        }
        if (values.length) {
            await db_1.idb.none(`
            UPDATE transactions SET
              block_number = x.block_number::INT,
              block_timestamp = x.block_timestamp::INT
            FROM (
              VALUES ${db_1.pgp.helpers.values(values, columns)}
            ) AS x(hash, block_number, block_timestamp)
            WHERE transactions.hash = x.hash::BYTEA
          `);
        }
        if (results.length >= limit) {
            const lastResult = results[results.length - 1];
            await (0, exports.addToQueue)((0, utils_1.fromBuffer)(lastResult.hash));
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock-5`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (hash) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { hash });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-transaction-block-fields.js.map