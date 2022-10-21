"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionAttributesV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getCollectionAttributesV1Options = {
    description: "Get detailed aggregate about attributes in a collection, e.g. trait floors",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
        query: joi_1.default.object({
            attributeKey: joi_1.default.string(),
            sortBy: joi_1.default.string().valid("floorAskPrice", "topBidValue").default("floorAskPrice"),
            offset: joi_1.default.number().integer().min(0).max(10000).default(0),
            limit: joi_1.default.number().integer().min(1).max(200).default(20),
        }),
    },
    response: {
        schema: joi_1.default.object({
            attributes: joi_1.default.array().items(joi_1.default.object({
                key: joi_1.default.string().required(),
                value: joi_1.default.string().required(),
                tokenCount: joi_1.default.number().required(),
                sampleImages: joi_1.default.array().items(joi_1.default.string().allow(null, "")),
                lastBuys: joi_1.default.array().items(joi_1.default.object({
                    value: joi_1.default.number().unsafe().required(),
                    timestamp: joi_1.default.number().required(),
                })),
                lastSells: joi_1.default.array().items(joi_1.default.object({
                    value: joi_1.default.number().unsafe().required(),
                    timestamp: joi_1.default.number().required(),
                })),
                floorAskPrices: joi_1.default.array().items(joi_1.default.number().unsafe()),
                topBid: joi_1.default.object({
                    id: joi_1.default.string().allow(null),
                    value: joi_1.default.number().unsafe().allow(null),
                    maker: joi_1.default.string()
                        .lowercase()
                        .pattern(/^0x[a-fA-F0-9]{40}$/)
                        .allow(null),
                    validFrom: joi_1.default.number().unsafe().allow(null),
                    validUntil: joi_1.default.number().unsafe().allow(null),
                }),
            })),
        }).label(`getCollectionAttributes${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collection-attributes-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        const params = request.params;
        try {
            let baseQuery = `
        SELECT
          "ta"."attribute_id",
          MIN("t"."floor_sell_value") AS "floor_sell_value",
          (
            array_agg(distinct("t"."image"))
          )[1:4] AS "sample_images",
          (
            (array_agg(
              "t"."floor_sell_value" ORDER BY "t"."floor_sell_value"
            )
            FILTER (WHERE "t"."floor_sell_value" IS NOT NULL)
          )::text[])[1:21] AS "floor_sell_values",
          (
            (array_agg(
              json_build_object(
                'value', "t"."last_sell_value"::text,
                'timestamp', "t"."last_sell_timestamp"
              ) ORDER BY "t"."last_sell_timestamp" DESC
            )
            FILTER (WHERE "t"."last_sell_value" IS NOT NULL)
          )::json[])[1:11] AS "last_sells",
          (
            (array_agg(
              json_build_object(
                'value', "t"."last_buy_value"::text,
                'timestamp', "t"."last_buy_timestamp"
              ) ORDER BY "t"."last_buy_timestamp" DESC
            )
            FILTER (WHERE "t"."last_buy_value" IS NOT NULL)
          )::json[])[1:11] AS "last_buys"
        FROM "token_attributes" "ta"
        JOIN "attributes" "a"
          ON "ta"."attribute_id" = "a"."id"
        JOIN "attribute_keys" "ak"
          ON "a"."attribute_key_id" = "ak"."id"
        JOIN "tokens" "t"
          ON "ta"."contract" = "t"."contract"
          AND "ta"."token_id" = "t"."token_id"
      `;
            // Filters
            const conditions = [
                `"ak"."collection_id" = $/collection/`,
                `"ak"."rank" IS NOT NULL`,
            ];
            if (query.attributeKey) {
                conditions.push(`"ak"."key" = $/attributeKey/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Grouping
            baseQuery += ` GROUP BY "ta"."attribute_id"`;
            baseQuery = `
        WITH "x" AS (${baseQuery})
        SELECT
          "x".*,
          "y".*,
          "ak"."key",
          "a"."value",
          "a"."token_count"
        FROM "x"
        JOIN "attributes" "a"
          ON "x"."attribute_id" = "a"."id"
        JOIN "attribute_keys" "ak"
          ON "a"."attribute_key_id" = "ak"."id"
        LEFT JOIN LATERAL (
          SELECT
            "ts"."top_buy_id",
            "ts"."top_buy_value",
            "ts"."top_buy_maker",
            date_part('epoch', lower("o"."valid_between")) AS "top_buy_valid_from",
            coalesce(
              nullif(date_part('epoch', upper("o"."valid_between")), 'Infinity'),
              0
            ) AS "top_buy_valid_until"
          FROM "token_sets" "ts"
          LEFT JOIN "orders" "o"
            ON "ts"."top_buy_id" = "o"."id"
          WHERE "ts"."attribute_id" = "a"."id"
          ORDER BY "ts"."top_buy_value" DESC NULLS LAST
          LIMIT 1
        ) "y" ON TRUE
      `;
            // Sorting
            switch (query.sortBy) {
                case "floorAskPrice": {
                    baseQuery += ` ORDER BY "x"."floor_sell_value"`;
                    break;
                }
                case "topBuyValue":
                default: {
                    baseQuery += ` ORDER BY "y"."top_buy_value" DESC NULLS LAST`;
                    break;
                }
            }
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            const result = await db_1.redb.manyOrNone(baseQuery, { ...query, ...params }).then((result) => result.map((r) => ({
                key: r.key,
                value: r.value,
                tokenCount: Number(r.token_count),
                sampleImages: r.sample_images || [],
                lastBuys: (r.last_buys || []).map(({ value, timestamp }) => ({
                    value: (0, utils_1.formatEth)(value),
                    timestamp: Number(timestamp),
                })),
                lastSells: (r.last_sells || []).map(({ value, timestamp }) => ({
                    value: (0, utils_1.formatEth)(value),
                    timestamp: Number(timestamp),
                })),
                floorAskPrices: (r.floor_sell_values || []).map(utils_1.formatEth),
                topBid: {
                    id: r.top_buy_id,
                    value: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                    maker: r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null,
                    validFrom: r.top_buy_valid_from,
                    validUntil: r.top_buy_value ? r.top_buy_valid_until : null,
                },
            })));
            return { attributes: result };
        }
        catch (error) {
            logger_1.logger.error(`get-collection-attributes-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map