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
exports.postSyncEventsOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const eventsSyncBackfill = __importStar(require("@/jobs/events-sync/backfill-queue"));
exports.postSyncEventsOptions = {
    description: "Trigger syncing of events.",
    tags: ["api", "x-admin"],
    timeout: {
        server: 2 * 60 * 1000,
    },
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            // WARNING: Some events should always be fetched together!
            syncDetails: joi_1.default.alternatives(joi_1.default.object({
                method: joi_1.default.string().valid("events"),
                events: joi_1.default.array().items(joi_1.default.string()),
            }), joi_1.default.object({
                method: joi_1.default.string().valid("address"),
                address: joi_1.default.string().pattern(utils_1.regex.address),
            })),
            fromBlock: joi_1.default.number().integer().positive().required(),
            toBlock: joi_1.default.number().integer().positive().required(),
            blocksPerBatch: joi_1.default.number().integer().positive(),
            skipNonFillWrites: joi_1.default.boolean().default(false),
            backfill: joi_1.default.boolean().default(true),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const syncDetails = payload.syncDetails;
            const fromBlock = payload.fromBlock;
            const toBlock = payload.toBlock;
            const blocksPerBatch = payload.blocksPerBatch;
            const backfill = payload.backfill;
            await eventsSyncBackfill.addToQueue(fromBlock, toBlock, {
                backfill,
                syncDetails,
                blocksPerBatch,
            });
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error("post-sync-events-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-sync-events.js.map