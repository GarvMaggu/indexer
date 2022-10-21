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
exports.getUserActivityV4Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const activities_entity_1 = require("@/models/activities/activities-entity");
const user_activities_1 = require("@/models/user-activities");
const sources_1 = require("@/models/sources");
const orders_1 = require("@/orderbook/orders");
const collection_sets_1 = require("@/models/collection-sets");
const Boom = __importStar(require("@hapi/boom"));
const version = "v4";
exports.getUserActivityV4Options = {
    description: "Users activity",
    notes: "This API can be used to build a feed for a user",
    tags: ["api", "Activity"],
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
            collection: joi_1.default.alternatives(joi_1.default.string().lowercase(), joi_1.default.array().items(joi_1.default.string().lowercase())).description("Filter to one or more collections. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection set."),
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community. Example: `artblocks`"),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(200)
                .default(20)
                .description("Amount of items returned in response."),
            sortBy: joi_1.default.string()
                .valid("eventTimestamp", "createdAt")
                .default("eventTimestamp")
                .description("Order the items are returned in the response, eventTimestamp = The blockchain event time, createdAt - The time in which event was recorded"),
            continuation: joi_1.default.string().description("Use continuation token to request next offset of items."),
            types: joi_1.default.alternatives()
                .try(joi_1.default.array().items(joi_1.default.string()
                .lowercase()
                .valid(...lodash_1.default.values(activities_entity_1.ActivityType))), joi_1.default.string()
                .lowercase()
                .valid(...lodash_1.default.values(activities_entity_1.ActivityType)))
                .description("Types of events returned in response. Example: 'types=sale'"),
        }).oxor("collection", "collectionsSetId", "community"),
    },
    response: {
        schema: joi_1.default.object({
            continuation: joi_1.default.string().allow(null),
            activities: joi_1.default.array().items(joi_1.default.object({
                type: joi_1.default.string(),
                fromAddress: joi_1.default.string(),
                toAddress: joi_1.default.string().allow(null),
                price: joi_1.default.number().unsafe(),
                amount: joi_1.default.number().unsafe(),
                timestamp: joi_1.default.number(),
                contract: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/)
                    .allow(null),
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
                order: joi_1.default.object({
                    id: joi_1.default.string().allow(null),
                    side: joi_1.default.string().valid("ask", "bid").allow(null),
                    source: joi_1.default.object().allow(null),
                }),
                createdAt: joi_1.default.string(),
            })),
        }).label(`getUserActivity${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-activity-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b;
        const query = request.query;
        if (query.types && !lodash_1.default.isArray(query.types)) {
            query.types = [query.types];
        }
        if (!lodash_1.default.isArray(query.users)) {
            query.users = [query.users];
        }
        if (query.continuation) {
            query.continuation = (0, utils_1.splitContinuation)(query.continuation)[0];
        }
        if (query.collectionsSetId) {
            query.collection = await collection_sets_1.CollectionSets.getCollectionsIds(query.collectionsSetId);
            if (lodash_1.default.isEmpty(query.collection)) {
                throw Boom.badRequest(`No collections for collection set ${query.collectionsSetId}`);
            }
        }
        try {
            const activities = await user_activities_1.UserActivities.getActivities(query.users, query.collection, query.community, query.continuation, query.types, query.limit, query.sortBy);
            // If no activities found
            if (!activities.length) {
                return { activities: [] };
            }
            const sources = await sources_1.Sources.getInstance();
            const result = [];
            for (const activity of activities) {
                let orderSource;
                if (activity.order) {
                    const orderSourceIdInt = activity.order.sourceIdInt ||
                        ((_a = (await (0, orders_1.getOrderSourceByOrderKind)(activity.order.kind))) === null || _a === void 0 ? void 0 : _a.id);
                    orderSource = orderSourceIdInt ? sources.get(orderSourceIdInt) : undefined;
                }
                result.push({
                    type: activity.type,
                    fromAddress: activity.fromAddress,
                    toAddress: activity.toAddress,
                    price: (0, utils_1.formatEth)(activity.price),
                    amount: activity.amount,
                    timestamp: activity.eventTimestamp,
                    createdAt: activity.createdAt.toISOString(),
                    contract: activity.contract,
                    token: activity.token,
                    collection: activity.collection,
                    txHash: activity.metadata.transactionHash,
                    logIndex: activity.metadata.logIndex,
                    batchIndex: activity.metadata.batchIndex,
                    order: ((_b = activity.order) === null || _b === void 0 ? void 0 : _b.id)
                        ? {
                            id: activity.order.id,
                            side: activity.order.side === "sell" ? "ask" : "bid",
                            source: orderSource
                                ? {
                                    domain: orderSource === null || orderSource === void 0 ? void 0 : orderSource.domain,
                                    name: (orderSource === null || orderSource === void 0 ? void 0 : orderSource.metadata.title) || (orderSource === null || orderSource === void 0 ? void 0 : orderSource.name),
                                    icon: orderSource === null || orderSource === void 0 ? void 0 : orderSource.metadata.icon,
                                }
                                : undefined,
                        }
                        : undefined,
                });
            }
            // Set the continuation node
            let continuation = null;
            if (activities.length === query.limit) {
                const lastActivity = lodash_1.default.last(activities);
                if (lastActivity) {
                    const continuationValue = query.sortBy == "eventTimestamp"
                        ? lastActivity.eventTimestamp
                        : lastActivity.createdAt.toISOString();
                    continuation = (0, utils_1.buildContinuation)(`${continuationValue}`);
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
//# sourceMappingURL=v4.js.map