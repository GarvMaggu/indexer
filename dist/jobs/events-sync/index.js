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
const provider_1 = require("@/common/provider");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
const realtimeEventsSync = __importStar(require("@/jobs/events-sync/realtime-queue"));
// For syncing events we have two separate job queues. One is for
// handling backfilling of past event while the other one handles
// realtime syncing of events. The reason for having these two be
// separated is that we don't want any ongoing backfilling action
// to delay realtime syncing (which tries to catch up to the head
// of the blockchain). Apart from these, we also have several job
// queues (that are single-threaded) which act as writing buffers
// for queries that are prone to database deadlocks (these are ft
// and nft transfer events writes which can run into deadlocks on
// concurrent upserts of the balances):
// https://stackoverflow.com/questions/46366324/postgres-deadlocks-on-concurrent-upserts
require("@/jobs/events-sync/backfill-queue");
require("@/jobs/events-sync/block-check-queue");
require("@/jobs/events-sync/process/backfill");
require("@/jobs/events-sync/process/realtime");
require("@/jobs/events-sync/realtime-queue");
require("@/jobs/events-sync/write-buffers/ft-transfers");
require("@/jobs/events-sync/write-buffers/nft-transfers");
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork && index_1.config.catchup) {
    const networkSettings = (0, network_1.getNetworkSettings)();
    // Keep up with the head of the blockchain by polling for new blocks every once in a while
    node_cron_1.default.schedule(`*/${networkSettings.realtimeSyncFrequencySeconds} * * * * *`, async () => await redis_1.redlock
        .acquire(["events-sync-catchup-lock"], (networkSettings.realtimeSyncFrequencySeconds - 1) * 1000)
        .then(async () => {
        logger_1.logger.info("events-sync-catchup", "Catching up events");
        try {
            await realtimeEventsSync.addToQueue();
        }
        catch (error) {
            logger_1.logger.error("events-sync-catchup", `Failed to catch up events: ${error}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
    // MASTER ONLY
    if (index_1.config.master && networkSettings.enableWebSocket) {
        // Besides the manual polling of events via the above cron job
        // we're also integrating WebSocket subscriptions to fetch the
        // latest events as soon as they're hapenning on-chain. We are
        // still keeping the manual polling though to ensure no events
        // are being missed.
        (0, provider_1.safeWebSocketSubscription)(async (provider) => {
            provider.on("block", async (block) => {
                logger_1.logger.info("events-sync-catchup", `Detected new block ${block}`);
                try {
                    await realtimeEventsSync.addToQueue();
                }
                catch (error) {
                    logger_1.logger.error("events-sync-catchup", `Failed to catch up events: ${error}`);
                }
            });
        });
    }
}
//# sourceMappingURL=index.js.map