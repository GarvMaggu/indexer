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
exports.postSyncDailyVolumes = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const daily_volume_1 = require("../../../models/daily-volumes/daily-volume");
const dailyVolumes = __importStar(require("@/jobs/daily-volumes/daily-volumes"));
exports.postSyncDailyVolumes = {
    description: "Trigger a re-sync of daily volume calculations, " +
        "volumes should only be calculated when fill_events have been fully synced",
    tags: ["api", "x-admin"],
    timeout: {
        server: 2 * 60 * 1000,
    },
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            days: joi_1.default.number()
                .integer()
                .positive()
                .default(0)
                .description("If no days are passed, will automatically resync from beginning of time."),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            let days = 0;
            if (payload.days) {
                days = payload.days;
            }
            // Get the current day timestamp
            const date = new Date();
            date.setUTCHours(0, 0, 0, 0);
            const currentDay = date.getTime() / 1000;
            // If no days are set, lets take the earliest fill_event that we have in the database
            // we calculate from that time onwards
            let startDay = 0;
            if (!days) {
                const values = await db_1.redb.oneOrNone(`SELECT MIN(timestamp) as earliest FROM fill_events_2`);
                if (values) {
                    const earliestDate = new Date(values.earliest);
                    earliestDate.setUTCHours(0, 0, 0, 0);
                    startDay = earliestDate.getTime(); // Don't divide by 1000, it's already in seconds because the db is in secs
                }
                days = (currentDay - startDay) / (3600 * 24);
            }
            else {
                startDay = currentDay - days * 3600 * 24;
            }
            if (!(await daily_volume_1.DailyVolume.initiateLock(days))) {
                return {
                    message: "Job to update daily volumes is already running, please wait until it's finished",
                };
            }
            // Trigger a sync job for each day
            for (let x = startDay; x < currentDay; x = x + 3600 * 24) {
                await dailyVolumes.addToQueue(x, true);
            }
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error("post-sync-daily-volumes", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-sync-daily-volumes.js.map