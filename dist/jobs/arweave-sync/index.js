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
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const arweaveSyncPending = __importStar(require("@/jobs/arweave-sync/pending-queue"));
const arweaveSyncRealtime = __importStar(require("@/jobs/arweave-sync/realtime-queue"));
require("@/jobs/arweave-sync/backfill-queue");
require("@/jobs/arweave-sync/pending-queue");
require("@/jobs/arweave-sync/realtime-queue");
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork && index_1.config.catchup && !index_1.config.disableOrders) {
    // In the same way as we do for syncing events, we poll
    // Arweave periodically to fetch any new blocks.
    node_cron_1.default.schedule("*/1 * * * *", async () => await redis_1.redlock
        .acquire(["arweave-sync-catchup-lock"], (60 - 5) * 1000)
        .then(async () => {
        logger_1.logger.info("arweave-sync-catchup", "Catching up Arweave data");
        try {
            await arweaveSyncRealtime.addToQueue();
        }
        catch (error) {
            logger_1.logger.error("arweave-sync-catchup", `Failed to catch up Arweave data: ${error}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
    // We should poll Arweave very often in order to get any new pending
    // transactions. This will allow us to get any incoming data as soon
    // as it hits the Arweave mempool.
    node_cron_1.default.schedule("*/30 * * * * *", async () => await redis_1.redlock
        .acquire(["arweave-sync-pending-lock"], 25 * 1000)
        .then(async () => {
        logger_1.logger.info("arweave-sync-pending", "Syncing pending Arweave data");
        try {
            await arweaveSyncPending.addToQueue();
        }
        catch (error) {
            logger_1.logger.error("arweave-sync-pending", `Failed to sync pending Arweave data: ${error}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
}
//# sourceMappingURL=index.js.map