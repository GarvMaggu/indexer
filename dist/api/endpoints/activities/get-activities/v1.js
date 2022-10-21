"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityV1Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const activities_1 = require("@/models/activities");
const sources_1 = require("@/models/sources");
const version = "v1";
exports.getActivityV1Options = {
    description: "All activity",
    notes: "This API can be used to scrape all of the activities",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 1,
        },
    },
    validate: {
        query: joi_1.default.object({
            limit: joi_1.default.number().integer().min(1).max(1000).default(20),
            continuation: joi_1.default.number(),
        }),
    },
    response: {
        schema: joi_1.default.object({
            continuation: joi_1.default.number()
                .allow(null)
                .description("Use continuation token to request next offset of items."),
            activities: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.number(),
                type: joi_1.default.string(),
                contract: joi_1.default.string(),
                collectionId: joi_1.default.string().allow(null),
                tokenId: joi_1.default.string().allow(null),
                fromAddress: joi_1.default.string(),
                toAddress: joi_1.default.string().allow(null),
                price: joi_1.default.number().unsafe(),
                amount: joi_1.default.number().unsafe(),
                timestamp: joi_1.default.number(),
                txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32).allow(null),
                logIndex: joi_1.default.number().allow(null),
                batchIndex: joi_1.default.number().allow(null),
                source: joi_1.default.object().allow(null),
            }).description("Amount of items returned in response.")),
        }).label(`getActivity${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-activity-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            const activities = await activities_1.Activities.getActivities(query.continuation, query.limit);
            // If no activities found
            if (!activities.length) {
                return { activities: [] };
            }
            const sources = await sources_1.Sources.getInstance();
            const result = lodash_1.default.map(activities, (activity) => {
                const source = activity.metadata.orderSourceIdInt
                    ? sources.get(activity.metadata.orderSourceIdInt)
                    : undefined;
                return {
                    id: Number(activity.id),
                    type: activity.type,
                    contract: activity.contract,
                    collectionId: activity.collectionId,
                    tokenId: activity.tokenId,
                    fromAddress: activity.fromAddress,
                    toAddress: activity.toAddress,
                    price: (0, utils_1.formatEth)(activity.price),
                    amount: activity.amount,
                    timestamp: activity.eventTimestamp,
                    txHash: activity.metadata.transactionHash,
                    logIndex: activity.metadata.logIndex,
                    batchIndex: activity.metadata.batchIndex,
                    source: source
                        ? {
                            domain: source === null || source === void 0 ? void 0 : source.domain,
                            name: (source === null || source === void 0 ? void 0 : source.metadata.title) || (source === null || source === void 0 ? void 0 : source.name),
                            icon: source === null || source === void 0 ? void 0 : source.metadata.icon,
                        }
                        : undefined,
                };
            });
            // Set the continuation node
            let continuation = null;
            if (activities.length === query.limit) {
                const lastActivity = lodash_1.default.last(activities);
                if (lastActivity) {
                    continuation = Number(lastActivity.id);
                }
            }
            return { activities: result, continuation };
        }
        catch (error) {
            logger_1.logger.error(`get-activity-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map