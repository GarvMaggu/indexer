"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderEventsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const version = "v1";
exports.getOrderEventsV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 5000,
    },
    description: "Order status changes",
    notes: "Get updates any time an order status changes",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 4,
        },
    },
    validate: {
        query: joi_1.default.object({
            contract: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
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
        }).oxor("contract"),
    },
    response: {
        schema: joi_1.default.object({
            events: joi_1.default.array().items(joi_1.default.object({
                order: joi_1.default.object({
                    id: joi_1.default.string(),
                    status: joi_1.default.string(),
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                    tokenId: joi_1.default.string().pattern(utils_1.regex.number),
                    maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                    price: joi_1.default.number().unsafe().allow(null),
                    quantityRemaining: joi_1.default.number().unsafe(),
                    nonce: joi_1.default.string().pattern(utils_1.regex.number).allow(null),
                    validFrom: joi_1.default.number().unsafe().allow(null),
                    validUntil: joi_1.default.number().unsafe().allow(null),
                    source: joi_1.default.string().allow(null, ""),
                }),
                event: joi_1.default.object({
                    id: joi_1.default.number().unsafe(),
                    kind: joi_1.default.string().valid("new-order", "expiry", "sale", "cancel", "balance-change", "approval-change", "bootstrap", "revalidation", "reprice"),
                    txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32).allow(null),
                    txTimestamp: joi_1.default.number().allow(null),
                    createdAt: joi_1.default.string(),
                }),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getOrderEvents${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-order-events-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          order_events.id,
          order_events.kind,
          order_events.status,
          order_events.contract,
          order_events.token_id,
          order_events.order_id,
          order_events.order_quantity_remaining,
          order_events.order_nonce,
          order_events.maker,
          order_events.price,
          order_events.order_source_id_int,
          coalesce(
            nullif(date_part('epoch', upper(order_events.order_valid_between)), 'Infinity'),
            0
          ) AS valid_until,
          date_part('epoch', lower(order_events.order_valid_between)) AS valid_from,
          order_events.tx_hash,
          order_events.tx_timestamp,
          extract(epoch from order_events.created_at) AS created_at
        FROM order_events
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
                `order_events.created_at >= to_timestamp($/startTimestamp/)`,
                `order_events.created_at <= to_timestamp($/endTimestamp/)`,
                // Fix for the issue with negative prices for dutch auction orders
                // (eg. due to orders not properly expired on time)
                `coalesce(order_events.price, 0) >= 0`,
            ];
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`order_events.contract = $/contract/`);
            }
            if (query.continuation) {
                const [createdAt, id] = (0, utils_1.splitContinuation)(query.continuation, /^\d+(.\d+)?_\d+$/);
                query.createdAt = createdAt;
                query.id = id;
                conditions.push(`(order_events.created_at, order_events.id) ${query.sortDirection === "asc" ? ">" : "<"} (to_timestamp($/createdAt/), $/id/)`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += `
        ORDER BY
          order_events.created_at ${query.sortDirection},
          order_events.id ${query.sortDirection}
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
                var _a, _b;
                return ({
                    order: {
                        id: r.order_id,
                        status: r.status,
                        contract: (0, utils_1.fromBuffer)(r.contract),
                        tokenId: r.token_id,
                        maker: r.maker ? (0, utils_1.fromBuffer)(r.maker) : null,
                        price: r.price ? (0, utils_1.formatEth)(r.price) : null,
                        quantityRemaining: Number(r.order_quantity_remaining),
                        nonce: (_a = r.order_nonce) !== null && _a !== void 0 ? _a : null,
                        validFrom: r.valid_from ? Number(r.valid_from) : null,
                        validUntil: r.valid_until ? Number(r.valid_until) : null,
                        source: (_b = sources.get(r.order_source_id_int)) === null || _b === void 0 ? void 0 : _b.name,
                    },
                    event: {
                        id: r.id,
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
            logger_1.logger.error(`get-order-events-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map