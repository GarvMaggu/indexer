"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesV2Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v2";
exports.getSalesV2Options = {
    description: "Historical sales",
    notes: "Get recent sales for a contract or token.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            // TODO: Look into optimizing filtering by collection
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular contract, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/)
                .description("Filter to a particular token, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            offset: joi_1.default.number().integer().min(0).max(10000).default(0),
            limit: joi_1.default.number().integer().min(1).max(100).default(20),
        })
            .oxor("contract", "token")
            .or("contract", "token"),
    },
    response: {
        schema: joi_1.default.object({
            sales: joi_1.default.array().items(joi_1.default.object({
                token: joi_1.default.object({
                    contract: joi_1.default.string()
                        .lowercase()
                        .pattern(/^0x[a-fA-F0-9]{40}$/),
                    tokenId: joi_1.default.string().pattern(/^[0-9]+$/),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    collection: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        name: joi_1.default.string().allow(null, ""),
                    }),
                }),
                orderSide: joi_1.default.string().valid("ask", "bid"),
                from: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/),
                to: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/),
                amount: joi_1.default.string(),
                txHash: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{64}$/),
                timestamp: joi_1.default.number(),
                price: joi_1.default.number().unsafe().allow(null),
            })),
        }).label(`getSales${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-sales-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          "fe"."contract",
          "fe"."token_id",
          "t"."name",
          "t"."image",
          "t"."collection_id",
          "c"."name" AS "collection_name",
          "fe"."order_side",
          "fe"."maker",
          "fe"."taker",
          "fe"."amount",
          "fe"."tx_hash",
          "fe"."timestamp",
          "fe"."price"
        FROM "fill_events_2" "fe"
        JOIN "tokens" "t"
          ON "fe"."contract" = "t"."contract"
          AND "fe"."token_id" = "t"."token_id"
        JOIN "collections" "c"
          ON "t"."collection_id" = "c"."id"
      `;
            // Filters
            const conditions = [];
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`"fe"."contract" = $/contract/`);
            }
            if (query.token) {
                const [contract, tokenId] = query.token.split(":");
                query.contract = (0, utils_1.toBuffer)(contract);
                query.tokenId = tokenId;
                conditions.push(`"t"."contract" = $/contract/`);
                conditions.push(`"t"."token_id" = $/tokenId/`);
            }
            if (query.collection) {
                conditions.push(`"t"."collection_id" = $/collection/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += ` ORDER BY "fe"."block" DESC`;
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => ({
                token: {
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    tokenId: r.token_id,
                    name: r.name,
                    image: r.mage,
                    collection: {
                        id: r.collection_id,
                        name: r.collection_name,
                    },
                },
                orderSide: r.order_side === "sell" ? "ask" : "bid",
                from: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.maker) : (0, utils_1.fromBuffer)(r.taker),
                to: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.taker) : (0, utils_1.fromBuffer)(r.maker),
                amount: String(r.amount),
                txHash: (0, utils_1.fromBuffer)(r.tx_hash),
                timestamp: r.timestamp,
                price: r.price ? (0, utils_1.formatEth)(r.price) : null,
            })));
            return { sales: result };
        }
        catch (error) {
            logger_1.logger.error(`get-sales-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map