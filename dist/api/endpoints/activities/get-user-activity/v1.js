"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserActivityV1Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const activities_entity_1 = require("@/models/activities/activities-entity");
const user_activities_1 = require("@/models/user-activities");
const version = "v1";
exports.getUserActivityV1Options = {
    description: "User activity",
    notes: "This API can be used to build a feed for a user",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 1,
        },
    },
    validate: {
        params: joi_1.default.object({
            user: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Filter to a particular user. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
        }),
        query: joi_1.default.object({
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
                    tokenName: joi_1.default.string().allow(null),
                    tokenImage: joi_1.default.string().allow(null),
                }),
                collection: joi_1.default.object({
                    collectionId: joi_1.default.string().allow(null),
                    collectionName: joi_1.default.string().allow(null),
                    collectionImage: joi_1.default.string().allow(null),
                }),
                txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32).allow(null),
                logIndex: joi_1.default.number().allow(null),
                batchIndex: joi_1.default.number().allow(null),
            })),
        }).label(`getUserActivity${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-activity-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const query = request.query;
        if (query.types && !lodash_1.default.isArray(query.types)) {
            query.types = [query.types];
        }
        try {
            const activities = await user_activities_1.UserActivities.getActivities([params.user], [], "", query.continuation, query.types, query.limit);
            // If no activities found
            if (!activities.length) {
                return { activities: [] };
            }
            // Iterate over the activities
            const result = lodash_1.default.map(activities, (activity) => ({
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
            }));
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
//# sourceMappingURL=v1.js.map