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
const collectionUpdatesMetadata = __importStar(require("@/jobs/collection-updates/metadata-queue"));
const date_fns_1 = require("date-fns");
const collections_1 = require("@/models/collections");
const QUEUE_NAME = "collections-refresh-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 1000,
        removeOnFail: 1000,
        timeout: 120000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async () => {
        let collections = [];
        // Get all collections minted 24 hours ago
        const yesterday = (0, date_fns_1.sub)(new Date(), {
            days: 1,
        });
        const yesterdayStart = (0, date_fns_1.getUnixTime)((0, date_fns_1.set)(yesterday, { hours: 0, minutes: 0, seconds: 0 }));
        const yesterdayEnd = (0, date_fns_1.getUnixTime)((0, date_fns_1.set)(new Date(), { hours: 0, minutes: 0, seconds: 0 }));
        collections = collections.concat(await collections_1.Collections.getCollectionsMintedBetween(yesterdayStart, yesterdayEnd));
        // Get all collections minted 7 days ago
        const oneWeekAgo = (0, date_fns_1.sub)(new Date(), {
            days: 7,
        });
        const oneWeekAgoStart = (0, date_fns_1.getUnixTime)((0, date_fns_1.set)(oneWeekAgo, { hours: 0, minutes: 0, seconds: 0 }));
        const oneWeekAgoEnd = (0, date_fns_1.getUnixTime)((0, date_fns_1.set)((0, date_fns_1.add)(oneWeekAgo, { days: 1 }), { hours: 0, minutes: 0, seconds: 0 }));
        collections = collections.concat(await collections_1.Collections.getCollectionsMintedBetween(oneWeekAgoStart, oneWeekAgoEnd));
        // Get top collections by volume
        collections = collections.concat(await collections_1.Collections.getTopCollectionsByVolume());
        const contracts = lodash_1.default.map(collections, (collection) => collection.contract);
        await collectionUpdatesMetadata.addToQueue(contracts);
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async () => {
    await exports.queue.add((0, crypto_1.randomUUID)(), {});
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=collections-refresh.js.map