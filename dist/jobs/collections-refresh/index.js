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
const network_1 = require("@/config/network");
const collectionsRefresh = __importStar(require("@/jobs/collections-refresh/collections-refresh"));
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork && (0, network_1.getNetworkSettings)().enableMetadataAutoRefresh) {
    node_cron_1.default.schedule("30 23 * * *", async () => await redis_1.redlock
        .acquire(["daily-collections-metadata-refresh"], 5000)
        .then(async () => {
        logger_1.logger.info("daily-collections-refresh", "Starting refresh collections metadata");
        try {
            await collectionsRefresh.addToQueue();
        }
        catch (error) {
            logger_1.logger.error("daily-collections-refresh", `Failed to refresh: ${error}`);
        }
    })
        .catch((e) => {
        logger_1.logger.error("daily-collections-refresh", JSON.stringify({
            msg: e.message,
        }));
    }));
}
//# sourceMappingURL=index.js.map