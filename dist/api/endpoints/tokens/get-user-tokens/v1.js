"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserTokensV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getUserTokensV1Options = {
    description: "User tokens",
    notes: "Get tokens held by a user, along with ownership information such as associated orders and date acquired.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        params: joi_1.default.object({
            user: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .required(),
        }),
        query: joi_1.default.object({
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community, e.g. `artblocks`"),
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular contract, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            hasOffer: joi_1.default.boolean(),
            sortBy: joi_1.default.string().valid("topBuyValue"),
            sortDirection: joi_1.default.string().lowercase().valid("asc", "desc"),
            offset: joi_1.default.number().integer().min(0).max(10000).default(0),
            limit: joi_1.default.number().integer().min(1).max(20).default(20),
        }),
    },
    response: {
        schema: joi_1.default.object({
            tokens: joi_1.default.array().items(joi_1.default.object({
                token: joi_1.default.object({
                    contract: joi_1.default.string(),
                    tokenId: joi_1.default.string(),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    collection: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        name: joi_1.default.string().allow(null, ""),
                    }),
                    topBid: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        value: joi_1.default.number().unsafe().allow(null),
                        schema: joi_1.default.object().allow(null),
                    }),
                }),
                ownership: joi_1.default.object({
                    tokenCount: joi_1.default.string(),
                    onSaleCount: joi_1.default.string(),
                    floorSellValue: joi_1.default.number().unsafe().allow(null),
                    acquiredAt: joi_1.default.number().allow(null),
                }),
            })),
        }).label(`getUserTokens${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-tokens-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const query = request.query;
        try {
            let baseQuery = `
        SELECT DISTINCT ON ("t"."contract", "t"."token_id")
          "t"."contract",
          "t"."token_id",
          "t"."name",
          "t"."image",
          "t"."collection_id",
          "c"."name" as "collection_name",
          "nb"."amount" as "token_count",
          (CASE WHEN "t"."floor_sell_value" IS NOT NULL
            THEN 1
            ELSE 0
          END) AS "on_sale_count",
          "t"."floor_sell_id",
          "t"."top_buy_id",
          "t"."top_buy_value",
          "ts"."schema" AS "top_buy_schema",
          "nb"."amount" * "t"."top_buy_value" AS "total_buy_value",
          (
            SELECT "nte"."timestamp" FROM "nft_transfer_events" "nte"
            WHERE "nte"."address" = "t"."contract"
              AND "nte"."token_id" = "t"."token_id"
              AND "nte"."to" = $/user/
            ORDER BY "nte"."timestamp" DESC
            LIMIT 1
          ) AS "acquired_at"
        FROM "nft_balances" "nb"
        JOIN "tokens" "t"
          ON "nb"."contract" = "t"."contract"
          AND "nb"."token_id" = "t"."token_id"
        JOIN "collections" "c"
          ON "t"."collection_id" = "c"."id"
        LEFT JOIN "orders" "o"
          ON "t"."top_buy_id" = "o"."id"
        LEFT JOIN "token_sets" "ts"
          ON "o"."token_set_id" = "ts"."id"
      `;
            // Filters
            params.user = (0, utils_1.toBuffer)(params.user);
            const conditions = [`"nb"."owner" = $/user/`, `"nb"."amount" > 0`];
            if (query.community) {
                conditions.push(`"c"."community" = $/community/`);
            }
            if (query.collection) {
                conditions.push(`"t"."collection_id" = $/collection/`);
            }
            if (query.hasOffer) {
                conditions.push(`"t"."top_buy_value" IS NOT NULL`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // https://stackoverflow.com/a/18939498
            baseQuery = `SELECT "x".* FROM (${baseQuery}) "x"`;
            switch (query.sortBy) {
                case "topBuyValue":
                default: {
                    baseQuery += `
            ORDER BY
              "x"."top_buy_value" ${query.sortDirection || "DESC"} NULLS LAST,
              "x"."contract",
              "x"."token_id"
          `;
                    break;
                }
            }
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            const result = await db_1.redb.manyOrNone(baseQuery, { ...query, ...params }).then((result) => result.map((r) => ({
                token: {
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    tokenId: r.token_id,
                    name: r.name,
                    image: r.image,
                    collection: {
                        id: r.collection_id,
                        name: r.collection_name,
                    },
                    topBid: {
                        id: r.top_buy_id,
                        value: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                        schema: r.top_buy_schema,
                    },
                },
                ownership: {
                    tokenCount: String(r.token_count),
                    onSaleCount: String(r.on_sale_count),
                    floorSellValue: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                    acquiredAt: Number(r.acquired_at),
                },
            })));
            return { tokens: result };
        }
        catch (error) {
            logger_1.logger.error(`get-user-tokens-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map