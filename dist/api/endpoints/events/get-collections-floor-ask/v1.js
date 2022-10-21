"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionsFloorAskV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const version = "v1";
exports.getCollectionsFloorAskV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 1000,
    },
    description: "Collection floor changes",
    notes: "Every time the floor price of a collection changes (i.e. the 'floor ask'), an event is generated. This API is designed to be polled at high frequency, in order to keep an external system in sync with accurate prices for any token.\n\nThere are multiple event types, which describe what caused the change in price:\n\n- `new-order` > new listing at a lower price\n\n- `expiry` > the previous best listing expired\n\n- `sale` > the previous best listing was filled\n\n- `cancel` > the previous best listing was cancelled\n\n- `balance-change` > the best listing was invalidated due to no longer owning the NFT\n\n- `approval-change` > the best listing was invalidated due to revoked approval\n\n- `revalidation` > manual revalidation of orders (e.g. after a bug fixed)\n\n- `reprice` > price update for dynamic orders (e.g. dutch auctions)\n\n- `bootstrap` > initial loading of data, so that all tokens have a price associated\n\nSome considerations to keep in mind\n\n- Due to the complex nature of monitoring off-chain liquidity across multiple marketplaces, including dealing with block re-orgs, events should be considered 'relative' to the perspective of the indexer, ie _when they were discovered_, rather than _when they happened_. A more deterministic historical record of price changes is in development, but in the meantime, this method is sufficent for keeping an external system in sync with the best available prices.\n\n- Events are only generated if the best price changes. So if a new order or sale happens without changing the best price, no event is generated. This is more common with 1155 tokens, which have multiple owners and more depth. For this reason, if you need sales data, use the Sales API.",
    tags: ["api", "Events"],
    plugins: {
        "hapi-swagger": {
            order: 4,
        },
    },
    validate: {
        query: joi_1.default.object({
            collection: joi_1.default.string().description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            startTimestamp: joi_1.default.number().description("Get events after a particular unix timestamp (inclusive)"),
            endTimestamp: joi_1.default.number().description("Get events before a particular unix timestamp (inclusive)"),
            sortDirection: joi_1.default.string()
                .valid("asc", "desc")
                .default("desc")
                .description("Order the items are returned in the response."),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(1000)
                .default(50)
                .description("Amount of items returned in response."),
        }).oxor("collection"),
    },
    response: {
        schema: joi_1.default.object({
            events: joi_1.default.array().items(joi_1.default.object({
                collection: joi_1.default.object({
                    id: joi_1.default.string(),
                }),
                floorAsk: joi_1.default.object({
                    orderId: joi_1.default.string().allow(null),
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                    tokenId: joi_1.default.string().pattern(utils_1.regex.number).allow(null),
                    maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                    price: joi_1.default.number().unsafe().allow(null),
                    validUntil: joi_1.default.number().unsafe().allow(null),
                    source: joi_1.default.string().allow(null, ""),
                }),
                event: joi_1.default.object({
                    id: joi_1.default.number().unsafe(),
                    kind: joi_1.default.string().valid("new-order", "expiry", "sale", "cancel", "balance-change", "approval-change", "bootstrap", "revalidation", "reprice"),
                    previousPrice: joi_1.default.number().unsafe().allow(null),
                    txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32).allow(null),
                    txTimestamp: joi_1.default.number().allow(null),
                    createdAt: joi_1.default.string(),
                }),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getCollectionsFloorAsk${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collections-floor-ask-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          coalesce(
            nullif(date_part('epoch', upper(collection_floor_sell_events.order_valid_between)), 'Infinity'),
            0
          ) AS valid_until,
          collection_floor_sell_events.id,
          collection_floor_sell_events.kind,
          collection_floor_sell_events.collection_id,
          collection_floor_sell_events.contract,
          collection_floor_sell_events.token_id,
          collection_floor_sell_events.order_id,
          collection_floor_sell_events.order_source_id_int,
          collection_floor_sell_events.maker,
          collection_floor_sell_events.price,
          collection_floor_sell_events.previous_price,
          collection_floor_sell_events.tx_hash,
          collection_floor_sell_events.tx_timestamp,
          extract(epoch from collection_floor_sell_events.created_at) AS created_at
        FROM collection_floor_sell_events
      `;
            // We default in the code so that these values don't appear in the docs
            if (!query.startTimestamp) {
                query.startTimestamp = 0;
            }
            if (!query.endTimestamp) {
                query.endTimestamp = 9999999999;
            }
            // Filters
            const conditions = [
                `collection_floor_sell_events.created_at >= to_timestamp($/startTimestamp/)`,
                `collection_floor_sell_events.created_at <= to_timestamp($/endTimestamp/)`,
                // Fix for the issue with negative prices for dutch auction orders
                // (eg. due to orders not properly expired on time)
                `coalesce(collection_floor_sell_events.price, 0) >= 0`,
            ];
            if (query.collection) {
                conditions.push(`collection_floor_sell_events.collection_id = $/collection/`);
            }
            if (query.continuation) {
                const [createdAt, id] = (0, utils_1.splitContinuation)(query.continuation, /^\d+(.\d+)?_\d+$/);
                query.createdAt = createdAt;
                query.id = id;
                conditions.push(`(collection_floor_sell_events.created_at, collection_floor_sell_events.id) ${query.sortDirection === "asc" ? ">" : "<"} (to_timestamp($/createdAt/), $/id/)`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += `
        ORDER BY
          collection_floor_sell_events.created_at ${query.sortDirection},
          collection_floor_sell_events.id ${query.sortDirection}
      `;
            // Pagination
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            let continuation = null;
            if (rawResult.length === query.limit) {
                continuation = (0, utils_1.buildContinuation)(rawResult[rawResult.length - 1].created_at + "_" + rawResult[rawResult.length - 1].id);
            }
            const sources = await sources_1.Sources.getInstance();
            const result = rawResult.map((r) => {
                var _a;
                return ({
                    collection: {
                        id: r.collection_id,
                    },
                    floorAsk: {
                        orderId: r.order_id,
                        contract: r.contract ? (0, utils_1.fromBuffer)(r.contract) : null,
                        tokenId: r.token_id,
                        maker: r.maker ? (0, utils_1.fromBuffer)(r.maker) : null,
                        price: r.price ? (0, utils_1.formatEth)(r.price) : null,
                        validUntil: r.price ? Number(r.valid_until) : null,
                        source: (_a = sources.get(r.order_source_id_int)) === null || _a === void 0 ? void 0 : _a.name,
                    },
                    event: {
                        id: r.id,
                        previousPrice: r.previous_price ? (0, utils_1.formatEth)(r.previous_price) : null,
                        kind: r.kind,
                        txHash: r.tx_hash ? (0, utils_1.fromBuffer)(r.tx_hash) : null,
                        txTimestamp: r.tx_timestamp ? Number(r.tx_timestamp) : null,
                        createdAt: new Date(r.created_at * 1000).toISOString(),
                    },
                });
            });
            return {
                events: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-collections-floor-ask-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map