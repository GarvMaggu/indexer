"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserActivityV2Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const activities_entity_1 = require("@/models/activities/activities-entity");
const user_activities_1 = require("@/models/user-activities");
const sources_1 = require("@/models/sources");
const version = "v2";
exports.getUserActivityV2Options = {
    description: "Users activity",
    notes: "This API can be used to build a feed for a user",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 1,
        },
    },
    validate: {
        query: joi_1.default.object({
            users: joi_1.default.alternatives()
                .try(joi_1.default.array()
                .items(joi_1.default.string().lowercase().pattern(utils_1.regex.address))
                .min(1)
                .max(50)
                .description("Array of users addresses. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"), joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Array of users addresses. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"))
                .required(),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(20)
                .default(20)
                .description("Amount of items returned in response."),
            continuation: joi_1.default.number().description("Use continuation token to request next offset of items."),
            types: joi_1.default.alternatives()
                .try(joi_1.default.array().items(joi_1.default.string()
                .lowercase()
                .valid(...lodash_1.default.values(activities_entity_1.ActivityType))), joi_1.default.string()
                .lowercase()
                .valid(...lodash_1.default.values(activities_entity_1.ActivityType)))
                .description("Types of events returned in response. Example: 'types=sale'"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            continuation: joi_1.default.number().allow(null),
            activities: joi_1.default.array().items(joi_1.default.object({
                type: joi_1.default.string(),
                fromAddress: joi_1.default.string(),
                toAddress: joi_1.default.string().allow(null),
                price: joi_1.default.number().unsafe(),
                amount: joi_1.default.number().unsafe(),
                timestamp: joi_1.default.number(),
                token: joi_1.default.object({
                    tokenId: joi_1.default.string().allow(null),
                    tokenName: joi_1.default.string().allow("", null),
                    tokenImage: joi_1.default.string().allow("", null),
                }),
                collection: joi_1.default.object({
                    collectionId: joi_1.default.string().allow(null),
                    collectionName: joi_1.default.string().allow("", null),
                    collectionImage: joi_1.default.string().allow("", null),
                }),
                txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32).allow(null),
                logIndex: joi_1.default.number().allow(null),
                batchIndex: joi_1.default.number().allow(null),
                source: joi_1.default.object().allow(null),
            })),
        }).label(`getUserActivity${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-activity-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        if (query.types && !lodash_1.default.isArray(query.types)) {
            query.types = [query.types];
        }
        if (!lodash_1.default.isArray(query.users)) {
            query.users = [query.users];
        }
        try {
            const activities = await user_activities_1.UserActivities.getActivities(query.users, [], "", query.continuation, query.types, query.limit);
            // If no activities found
            if (!activities.length) {
                return { activities: [] };
            }
            const sources = await sources_1.Sources.getInstance();
            // Iterate over the activities
            const result = lodash_1.default.map(activities, (activity) => {
                const source = activity.metadata.orderSourceIdInt
                    ? sources.get(activity.metadata.orderSourceIdInt)
                    : undefined;
                return {
                    type: activity.type,
                    fromAddress: activity.fromAddress,
                    toAddress: activity.toAddress,
                    price: (0, utils_1.formatEth)(activity.price),
                    amount: activity.amount,
                    timestamp: activity.eventTimestamp,
                    token: activity.token,
                    collection: activity.collection,
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
                    continuation = lastActivity.eventTimestamp;
                }
            }
            return { activities: result, continuation };
        }
        catch (error) {
            logger_1.logger.error(`get-user-activity-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map