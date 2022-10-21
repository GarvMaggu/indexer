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
const constants_1 = require("@ethersproject/constants");
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const p_limit_1 = __importDefault(require("p-limit"));
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const provider_1 = require("@/common/provider");
const transactionsModel = __importStar(require("@/models/transactions"));
const QUEUE_NAME = "backfill-transactions";
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
        const { block } = job.data;
        const b = await provider_1.baseProvider.getBlockWithTransactions(block);
        // Save all transactions within the block
        const limit = (0, p_limit_1.default)(20);
        await Promise.all(b.transactions.map((tx) => limit(async () => {
            var _a;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawTx = tx.raw;
            const gasPrice = (_a = tx.gasPrice) === null || _a === void 0 ? void 0 : _a.toString();
            const gasUsed = (rawTx === null || rawTx === void 0 ? void 0 : rawTx.gas) ? (0, utils_1.bn)(rawTx.gas).toString() : undefined;
            const gasFee = gasPrice && gasUsed ? (0, utils_1.bn)(gasPrice).mul(gasUsed).toString() : undefined;
            await transactionsModel.saveTransaction({
                hash: tx.hash.toLowerCase(),
                from: tx.from.toLowerCase(),
                to: (tx.to || constants_1.AddressZero).toLowerCase(),
                value: tx.value.toString(),
                data: tx.data.toLowerCase(),
                blockNumber: b.number,
                blockTimestamp: b.timestamp,
                gasPrice,
                gasUsed,
                gasFee,
            });
        })));
        if (block <= 15180000) {
            await (0, exports.addToQueue)(block + 1);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue(15050000);
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (block) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { block });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-transactions.js.map