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
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const exportData = __importStar(require("@/jobs/data-export/export-data"));
require("@/jobs/data-export/export-data");
const node_cron_1 = __importDefault(require("node-cron"));
const redis_1 = require("@/common/redis");
const getTasks = async () => {
    return await db_1.redb.manyOrNone(`SELECT source FROM data_export_tasks`);
};
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    node_cron_1.default.schedule("*/5 * * * *", async () => await redis_1.redlock
        .acquire([`data-export-cron-lock`], (5 * 60 - 5) * 1000)
        .then(async () => {
        getTasks()
            .then(async (tasks) => {
            for (const task of tasks) {
                await exportData.addToQueue(task.source);
            }
        })
            .catch(() => {
            // Skip on any errors
        });
    })
        .catch(() => {
        // Skip on any errors
    }));
}
//# sourceMappingURL=index.js.map