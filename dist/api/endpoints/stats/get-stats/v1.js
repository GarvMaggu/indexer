"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const tokens_1 = require("@/models/tokens");
const assets_1 = require("@/utils/assets");
const version = "v1";
exports.getStatsV1Options = {
    description: "Stats",
    notes: "Get aggregate stats for a particular set (collection, attribute or single token)",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 7,
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/)
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            attributes: joi_1.default.object()
                .unknown()
                .description("Filter to a particular attribute. Example: `attributes[Type]=Original`"),
        })
            .oxor("collection", "token")
            .or("collection", "token"),
    },
    response: {
        schema: joi_1.default.object({
            stats: joi_1.default.object({
                tokenCount: joi_1.default.number().required(),
                onSaleCount: joi_1.default.number().required(),
                sampleImages: joi_1.default.array().items(joi_1.default.string().allow("", null)),
                market: joi_1.default.object({
                    floorAsk: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        price: joi_1.default.number().unsafe().allow(null),
                        maker: joi_1.default.string()
                            .lowercase()
                            .pattern(/^0x[a-fA-F0-9]{40}$/)
                            .allow(null),
                        validFrom: joi_1.default.number().unsafe().allow(null),
                        validUntil: joi_1.default.number().unsafe().allow(null),
                        token: joi_1.default.object({
                            contract: joi_1.default.string()
                                .lowercase()
                                .pattern(/^0x[a-fA-F0-9]{40}$/)
                                .allow(null),
                            tokenId: joi_1.default.string()
                                .lowercase()
                                .pattern(/^[0-9]+$/)
                                .allow(null),
                            name: joi_1.default.string().allow("", null),
                            image: joi_1.default.string().allow("", null),
                        }),
                    }),
                    topBid: {
                        id: joi_1.default.string().allow(null),
                        value: joi_1.default.number().unsafe().allow(null),
                        maker: joi_1.default.string()
                            .lowercase()
                            .pattern(/^0x[a-fA-F0-9]{40}$/)
                            .allow(null),
                        validFrom: joi_1.default.number().unsafe().allow(null),
                        validUntil: joi_1.default.number().unsafe().allow(null),
                    },
                }),
            }).allow(null),
        }).label(`getStats${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-stats-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery;
            if (query.token) {
                const [contract, tokenId] = query.token.split(":");
                query.contract = (0, utils_1.toBuffer)(contract);
                query.tokenId = tokenId;
                query.topBidOrderId = null;
                const topBid = await tokens_1.Tokens.getTokensTopBid(contract, [tokenId]);
                if (!lodash_1.default.isEmpty(topBid)) {
                    query.topBidOrderId = topBid[0].orderId;
                }
                baseQuery = `
          SELECT
            1 AS "token_count",
            (
              CASE WHEN "t"."floor_sell_value" IS NOT NULL
                THEN 1
                ELSE 0
              END
            ) AS "on_sale_count",
            array["t"."image"] AS "sample_images",
            "t"."floor_sell_id",
            "t"."floor_sell_value",
            "t"."floor_sell_maker",
            date_part('epoch', lower("os"."valid_between")) AS "floor_sell_valid_from",
            coalesce(
              nullif(date_part('epoch', upper("os"."valid_between")), 'Infinity'),
              0
            ) AS "floor_sell_valid_until",
            "t"."contract",
            "t"."token_id",
            "t"."name",
            "t"."image",
            "ob"."id" AS "top_buy_id",
            "ob"."value" AS "top_buy_value",
            "ob"."maker" AS "top_buy_maker",
            date_part('epoch', lower("ob"."valid_between")) AS "top_buy_valid_from",
            coalesce(
              nullif(date_part('epoch', upper("ob"."valid_between")), 'Infinity'),
              0
            ) AS "top_buy_valid_until"
          FROM "tokens" "t"
          LEFT JOIN "orders" "os"
            ON "t"."floor_sell_id" = "os"."id"
          LEFT JOIN "orders" "ob"
            ON $/topBidOrderId/ = "ob"."id"
          WHERE "t"."contract" = $/contract/
            AND "t"."token_id" = $/tokenId/
        `;
            }
            else if (query.collection && query.attributes) {
                const attributes = [];
                Object.entries(query.attributes).forEach(([key, values]) => {
                    (Array.isArray(values) ? values : [values]).forEach((value) => attributes.push({ key, value }));
                });
                const conditions = [`"t"."collection_id" = $/collection/`];
                for (let i = 0; i < attributes.length; i++) {
                    query[`key${i}`] = attributes[i].key;
                    query[`value${i}`] = attributes[i].value;
                    conditions.push(`
            EXISTS (
              SELECT FROM "token_attributes" "ta"
              JOIN "attributes" "a"
                ON "ta"."attribute_id" = "a"."id"
              JOIN "attribute_keys" "ak"
                ON "a"."attribute_key_id" = "ak"."id"
              WHERE "ta"."contract" = "t"."contract"
                AND "ta"."token_id" = "t"."token_id"
                AND "ak"."key" = $/key${i}/
                AND "a"."value" = $/value${i}/
            )
          `);
                }
                // Filter out all tokens that match the specified attributes.
                let filterQuery = `
          SELECT
            "t"."contract",
            "t"."token_id",
            "t"."name",
            "t"."image",
            "t"."floor_sell_id",
            "t"."floor_sell_value",
            "t"."floor_sell_maker"
          FROM "tokens" "t"
        `;
                if (conditions.length) {
                    filterQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
                }
                const sellQuery = `
          SELECT
            "x"."contract",
            "x"."token_id",
            "x"."name",
            "x"."image",
            "x"."floor_sell_id",
            "x"."floor_sell_value",
            "x"."floor_sell_maker",
            date_part('epoch', lower("os"."valid_between")) AS "floor_sell_valid_from",
            coalesce(
              nullif(date_part('epoch', upper("os"."valid_between")), 'Infinity'),
              0
            ) AS "floor_sell_valid_until"
          FROM "x"
          LEFT JOIN "orders" "os"
            ON "x"."floor_sell_id" = "os"."id"
          ORDER BY "x"."floor_sell_value"
          LIMIT 1
        `;
                let buyQuery;
                if (attributes.length === 1) {
                    buyQuery = `
            SELECT
              "ts"."top_buy_id",
              "ts"."top_buy_value",
              "ts"."top_buy_maker",
              date_part('epoch', lower("ob"."valid_between")) AS "top_buy_valid_from",
              coalesce(
                nullif(date_part('epoch', upper("ob"."valid_between")), 'Infinity'),
                0
              ) AS "top_buy_valid_until"
            FROM "token_sets" "ts"
            LEFT JOIN "orders" "ob"
              ON "ts"."top_buy_id" = "ob"."id"
            WHERE "ts"."attribute_id" = (
                SELECT "a"."id" FROM "attributes" "a"
                JOIN "attribute_keys" "ak"
                  ON "a"."attribute_key_id" = "ak"."id"
                WHERE "ak"."collection_id" = $/collection/
                  AND "ak"."key" = $/key0/
                  AND "a"."value" = $/value0/
                LIMIT 1
              )
              AND "ts"."attribute_id" IS NOT NULL
            ORDER BY "ts"."top_buy_value" DESC NULLS LAST
            LIMIT 1
          `;
                }
                else {
                    // TODO: Update this part when support for orders on multiple
                    // attributes is integrated. That would require a refactoring
                    // of the `token_sets` table as well.
                    buyQuery = `
            SELECT
              NULL AS "top_buy_id",
              NULL AS "top_buy_value",
              NULL AS "top_buy_maker",
              NULL AS "top_buy_valid_from",
              NULL AS "top_buy_valid_to"
          `;
                }
                baseQuery = `
          WITH
            "x" AS (${filterQuery}),
            "y" AS (
              SELECT
                COUNT(*) AS "token_count",
                COUNT(*) FILTER (WHERE "x"."floor_sell_value" IS NOT NULL) AS "on_sale_count",
                (array_agg("x"."image"))[1:4] AS "sample_images"
              FROM "x"
            )
          SELECT
            "y".*,
            "z".*,
            "w".*
          FROM "y"
          LEFT JOIN LATERAL (${sellQuery}) "z" ON TRUE
          LEFT JOIN LATERAL (${buyQuery}) "w" ON TRUE
        `;
            }
            else if (query.collection) {
                baseQuery = `
          WITH "x" AS (
            SELECT DISTINCT ON ("t"."collection_id")
              "t"."collection_id",
              "t"."contract",
              "t"."token_id",
              "t"."name",
              "t"."image",
              "t"."floor_sell_id",
              "t"."floor_sell_value",
              "t"."floor_sell_maker",
              date_part('epoch', lower("os"."valid_between")) AS "floor_sell_valid_from",
              coalesce(
                nullif(date_part('epoch', upper("os"."valid_between")), 'Infinity'),
                0
              ) AS "floor_sell_valid_until"
            FROM "tokens" "t"
            LEFT JOIN "orders" "os"
              ON "t"."floor_sell_id" = "os"."id"
            WHERE "t"."collection_id" = $/collection/
            ORDER BY "t"."collection_id", "t"."floor_sell_value"
            LIMIT 1
          )
          SELECT
            "c"."token_count",
            "c"."token_set_id",
            (
              SELECT COUNT(*) FROM "tokens"
              WHERE "collection_id" = $/collection/
                AND "floor_sell_value" IS NOT NULL
            ) AS "on_sale_count",
            array(
              SELECT "t"."image" FROM "tokens" "t"
              WHERE "t"."collection_id" = $/collection/
              AND "t"."image" IS NOT NULL
              LIMIT 4
            ) AS "sample_images",
            "x".*,
            "y".*
          FROM "x"
          JOIN "collections" "c"
            ON "x"."collection_id" = "c"."id"
          LEFT JOIN LATERAL (
            SELECT
              "ts"."top_buy_id",
              "ts"."top_buy_value",
              "ts"."top_buy_maker",
              date_part('epoch', lower("ob"."valid_between")) AS "top_buy_valid_from",
              coalesce(
                nullif(date_part('epoch', upper("ob"."valid_between")), 'Infinity'),
                0
              ) AS "top_buy_valid_until"
            FROM "token_sets" "ts"
            LEFT JOIN "orders" "ob"
              ON "ts"."top_buy_id" = "ob"."id"
            WHERE "ts"."id" = "c"."token_set_id"
            ORDER BY "ts"."top_buy_value" DESC NULLS LAST
            LIMIT 1
          ) "y" ON TRUE
        `;
            }
            const result = await db_1.redb.oneOrNone(baseQuery, query).then((r) => r
                ? {
                    tokenCount: Number(r.token_count),
                    onSaleCount: Number(r.on_sale_count),
                    sampleImages: assets_1.Assets.getLocalAssetsLink(r.sample_images) || [],
                    market: {
                        floorAsk: {
                            id: r.floor_sell_id,
                            price: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                            maker: r.floor_sell_maker ? (0, utils_1.fromBuffer)(r.floor_sell_maker) : null,
                            validFrom: r.floor_sell_valid_from,
                            validUntil: r.floor_sell_value ? r.floor_sell_valid_until : null,
                            token: {
                                contract: r.contract ? (0, utils_1.fromBuffer)(r.contract) : null,
                                tokenId: r.token_id,
                                name: r.name,
                                image: assets_1.Assets.getLocalAssetsLink(r.image),
                            },
                        },
                        topBid: {
                            id: r.top_buy_id,
                            value: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                            maker: r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null,
                            validFrom: r.top_buy_valid_from,
                            validUntil: r.top_buy_value ? r.top_buy_valid_until : null,
                        },
                    },
                }
                : null);
            return { stats: result };
        }
        catch (error) {
            logger_1.logger.error(`get-stats-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map