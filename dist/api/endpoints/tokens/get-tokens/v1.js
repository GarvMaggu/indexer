"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokensV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getTokensV1Options = {
    description: "List of tokens",
    notes: "This API is optimized for quickly fetching a list of tokens in a collection, sorted by price, with only the most important information returned. If you need more metadata, use the `tokens/details` API",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
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
            tokenSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular set, e.g. `contract:0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            onSale: joi_1.default.boolean().description("Limit to tokens that are listed for sale"),
            sortBy: joi_1.default.string()
                .valid("tokenId", "floorAskPrice", "topBidValue")
                .default("floorAskPrice"),
            sortDirection: joi_1.default.string().lowercase().valid("asc", "desc"),
            offset: joi_1.default.number().integer().min(0).max(10000).default(0),
            limit: joi_1.default.number().integer().min(1).max(50).default(20),
        })
            .or("collection", "contract", "token", "tokenSetId")
            .oxor("collection", "contract", "token", "tokenSetId"),
    },
    response: {
        schema: joi_1.default.object({
            tokens: joi_1.default.array().items(joi_1.default.object({
                contract: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/)
                    .required(),
                tokenId: joi_1.default.string()
                    .pattern(/^[0-9]+$/)
                    .required(),
                name: joi_1.default.string().allow(null, ""),
                image: joi_1.default.string().allow(null, ""),
                collection: joi_1.default.object({
                    id: joi_1.default.string().allow(null),
                    name: joi_1.default.string().allow(null, ""),
                }),
                topBidValue: joi_1.default.number().unsafe().allow(null),
                floorAskPrice: joi_1.default.number().unsafe().allow(null),
            })),
        }).label(`getTokens${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-tokens-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          "t"."contract",
          "t"."token_id",
          "t"."name",
          "t"."image",
          "t"."collection_id",
          "c"."name" as "collection_name",
          "t"."floor_sell_value",
          "t"."top_buy_value"
        FROM "tokens" "t"
        JOIN "collections" "c"
          ON "t"."collection_id" = "c"."id"
      `;
            if (query.tokenSetId) {
                baseQuery += `
          JOIN "token_sets_tokens" "tst"
            ON "t"."contract" = "tst"."contract"
            AND "t"."token_id" = "tst"."token_id"
        `;
            }
            // Filters
            const conditions = [];
            if (query.collection) {
                conditions.push(`"t"."collection_id" = $/collection/`);
            }
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`"t"."contract" = $/contract/`);
            }
            if (query.token) {
                const [contract, tokenId] = query.token.split(":");
                query.contract = (0, utils_1.toBuffer)(contract);
                query.tokenId = tokenId;
                conditions.push(`"t"."contract" = $/contract/`);
                conditions.push(`"t"."token_id" = $/tokenId/`);
            }
            if (query.tokenSetId) {
                conditions.push(`"tst"."token_set_id" = $/tokenSetId/`);
            }
            if (query.onSale === true) {
                conditions.push(`"t"."floor_sell_value" IS NOT NULL`);
            }
            else if (query.onSale === false) {
                conditions.push(`"t"."floor_sell_value" IS NULL`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            switch (query.sortBy) {
                case "tokenId": {
                    baseQuery += ` ORDER BY "t"."token_id" ${query.sortDirection || "ASC"}`;
                    break;
                }
                case "topBidValue": {
                    baseQuery += ` ORDER BY "t"."top_buy_value" ${query.sortDirection || "DESC"} NULLS LAST, "t"."token_id"`;
                    break;
                }
                case "floorAskPrice":
                default: {
                    baseQuery += ` ORDER BY "t"."floor_sell_value" ${query.sortDirection || "ASC"} NULLS LAST, "t"."token_id"`;
                    break;
                }
            }
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => ({
                contract: (0, utils_1.fromBuffer)(r.contract),
                tokenId: r.token_id,
                name: r.name,
                image: r.image,
                collection: {
                    id: r.collection_id,
                    name: r.collection_name,
                },
                floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                topBidValue: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
            })));
            return { tokens: result };
        }
        catch (error) {
            logger_1.logger.error(`get-tokens-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map