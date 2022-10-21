"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBidEventsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const version = "v1";
exports.getBidEventsV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 5000,
    },
    description: "Bid status changes",
    notes: "Get updates any time a bid status changes",
    tags: ["api", "Events"],
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
                bid: joi_1.default.object({
                    id: joi_1.default.string(),
                    status: joi_1.default.string(),
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                    tokenSetId: joi_1.default.string(),
                    maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                    price: joi_1.default.number().unsafe().allow(null),
                    value: joi_1.default.number().unsafe().allow(null),
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
        }).label(`getBidEvents${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-bid-events-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          bid_events.id,
          bid_events.kind,
          bid_events.status,
          bid_events.contract,
          bid_events.token_set_id,
          bid_events.order_id,
          bid_events.order_quantity_remaining,
          bid_events.order_nonce,
          bid_events.maker,
          bid_events.price,
          bid_events.value,
          bid_events.order_source_id_int,
          coalesce(
            nullif(date_part('epoch', upper(bid_events.order_valid_between)), 'Infinity'),
            0
          ) AS valid_until,
          date_part('epoch', lower(bid_events.order_valid_between)) AS valid_from,
          bid_events.tx_hash,
          bid_events.tx_timestamp,
          extract(epoch from bid_events.created_at) AS created_at
        FROM bid_events
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
                `bid_events.created_at >= to_timestamp($/startTimestamp/)`,
                `bid_events.created_at <= to_timestamp($/endTimestamp/)`,
            ];
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`bid_events.contract = $/contract/`);
            }
            if (query.continuation) {
                const [createdAt, id] = (0, utils_1.splitContinuation)(query.continuation, /^\d+(.\d+)?_\d+$/);
                query.createdAt = createdAt;
                query.id = id;
                conditions.push(`(bid_events.created_at, bid_events.id) ${query.sortDirection === "asc" ? ">" : "<"} (to_timestamp($/createdAt/), $/id/)`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += `
        ORDER BY
          bid_events.created_at ${query.sortDirection},
          bid_events.id ${query.sortDirection}
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
                    bid: {
                        id: r.order_id,
                        status: r.status,
                        contract: (0, utils_1.fromBuffer)(r.contract),
                        tokenSetId: r.token_set_id,
                        maker: r.maker ? (0, utils_1.fromBuffer)(r.maker) : null,
                        price: r.price ? (0, utils_1.formatEth)(r.price) : null,
                        value: r.value ? (0, utils_1.formatEth)(r.value) : null,
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
            logger_1.logger.error(`get-bid-events-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map