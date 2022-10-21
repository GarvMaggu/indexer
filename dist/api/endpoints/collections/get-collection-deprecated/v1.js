"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionDeprecatedV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getCollectionDeprecatedV1Options = {
    description: "Single collection",
    notes: "Get detailed information about a single collection, including real-time stats.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        params: joi_1.default.object({
            collectionOrSlug: joi_1.default.string().lowercase().required(),
        }),
    },
    response: {
        schema: joi_1.default.object({
            collection: joi_1.default.object({
                id: joi_1.default.string(),
                slug: joi_1.default.string(),
                name: joi_1.default.string().allow(null, ""),
                metadata: joi_1.default.object().allow(null),
                sampleImages: joi_1.default.array().items(joi_1.default.string().allow(null, "")),
                tokenCount: joi_1.default.string(),
                onSaleCount: joi_1.default.string(),
                tokenSetId: joi_1.default.string().allow(null),
                royalties: joi_1.default.object({
                    recipient: joi_1.default.string().allow(null, ""),
                    bps: joi_1.default.number(),
                }),
                lastBuy: {
                    value: joi_1.default.number().unsafe().allow(null),
                    timestamp: joi_1.default.number().allow(null),
                },
                lastSell: {
                    value: joi_1.default.number().unsafe().allow(null),
                    timestamp: joi_1.default.number().allow(null),
                },
                floorAsk: {
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
                            .pattern(/^[0-9]+$/)
                            .allow(null),
                        name: joi_1.default.string().allow(null),
                        image: joi_1.default.string().allow(null, ""),
                    }).allow(null),
                },
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
                rank: joi_1.default.object({
                    "1day": joi_1.default.number().unsafe().allow(null),
                    "7day": joi_1.default.number().unsafe().allow(null),
                    "30day": joi_1.default.number().unsafe().allow(null),
                    allTime: joi_1.default.number().unsafe().allow(null),
                }),
                volume: joi_1.default.object({
                    "1day": joi_1.default.number().unsafe().allow(null),
                    "7day": joi_1.default.number().unsafe().allow(null),
                    "30day": joi_1.default.number().unsafe().allow(null),
                    allTime: joi_1.default.number().unsafe().allow(null),
                }),
            }).allow(null),
        }).label(`getCollectionDeprecated${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collection-deprecated-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        try {
            let baseQuery = `
        SELECT
          "c"."id",
          "c"."slug",
          "c"."name",
          "c"."metadata",
          "c"."royalties",
          "c"."token_set_id",
          "c"."day1_rank",
          "c"."day1_volume",
          "c"."day7_rank",
          "c"."day7_volume",
          "c"."day30_rank",
          "c"."day30_volume",
          "c"."all_time_rank",
          "c"."all_time_volume",
          "c"."token_count",
          (
            SELECT COUNT(*) FROM "tokens" "t"
            WHERE "t"."collection_id" = "c"."id"
              AND "t"."floor_sell_value" IS NOT NULL
          ) AS "on_sale_count",
          ARRAY(
            SELECT "t"."image" FROM "tokens" "t"
            WHERE "t"."collection_id" = "c"."id"
            LIMIT 4
          ) AS "sample_images"
        FROM "collections" "c"
      `;
            // If `collectionOrSlug` matches a contract address then we
            // assume the search is by collection id, otherwise it must
            // be a search by slug.
            if (params.collectionOrSlug.match(/0x[a-f0-9]{40}/g)) {
                baseQuery += ` WHERE "c"."id" = $/collectionOrSlug/`;
            }
            else {
                baseQuery += ` WHERE "c"."slug" = $/collectionOrSlug/`;
            }
            baseQuery += ` LIMIT 1`;
            baseQuery = `
        WITH "x" AS (${baseQuery})
        SELECT
          "x".*,
          "y".*,
          "z".*
        FROM "x"
        LEFT JOIN LATERAL (
          SELECT
            "t"."contract" AS "floor_sell_token_contract",
            "t"."token_id" AS "floor_sell_token_id",
            "t"."name" AS "floor_sell_token_name",
            "t"."image" AS "floor_sell_token_image",
            "t"."floor_sell_id",
            "t"."floor_sell_value",
            "t"."floor_sell_maker",
            DATE_PART('epoch', LOWER("o"."valid_between")) AS "floor_sell_valid_from",
              COALESCE(
                NULLIF(DATE_PART('epoch', UPPER("o"."valid_between")), 'Infinity'),
                0
              ) AS "floor_sell_valid_until",
            "t"."last_sell_value",
            "t"."last_sell_timestamp"
          FROM "tokens" "t"
          LEFT JOIN "orders" "o"
            ON "t"."floor_sell_id" = "o"."id"
          WHERE "t"."collection_id" = "x"."id"
          ORDER BY "t"."floor_sell_value"
          LIMIT 1
        ) "y" ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            "ts"."top_buy_id",
            "ts"."top_buy_value",
            "ts"."top_buy_maker",
            DATE_PART('epoch', LOWER("o"."valid_between")) AS "top_buy_valid_from",
            COALESCE(
              NULLIF(DATE_PART('epoch', UPPER("o"."valid_between")), 'Infinity'),
              0
            ) AS "top_buy_valid_until",
            "ts"."last_buy_value",
            "ts"."last_buy_timestamp"
          FROM "token_sets" "ts"
          LEFT JOIN "orders" "o"
            ON "ts"."top_buy_id" = "o"."id"
          WHERE "ts"."id" = "x"."token_set_id"
          ORDER BY "ts"."top_buy_value" DESC NULLS LAST
          LIMIT 1
        ) "z" ON TRUE
      `;
            const result = await db_1.redb.oneOrNone(baseQuery, params).then((r) => !r
                ? null
                : {
                    id: r.id,
                    slug: r.slug,
                    name: r.name,
                    metadata: r.metadata,
                    sampleImages: r.sample_images || [],
                    tokenCount: String(r.token_count),
                    onSaleCount: String(r.on_sale_count),
                    tokenSetId: r.token_set_id,
                    royalties: r.royalties ? r.royalties[0] : null,
                    lastBuy: {
                        value: r.last_buy_value ? (0, utils_1.formatEth)(r.last_buy_value) : null,
                        timestamp: r.last_buy_timestamp,
                    },
                    lastSell: {
                        value: r.last_sell_value ? (0, utils_1.formatEth)(r.last_sell_value) : null,
                        timestamp: r.last_sell_timestamp,
                    },
                    floorAsk: {
                        id: r.floor_sell_id,
                        price: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                        maker: r.floor_sell_maker ? (0, utils_1.fromBuffer)(r.floor_sell_maker) : null,
                        validFrom: r.floor_sell_valid_from,
                        validUntil: r.floor_sell_value ? r.floor_sell_valid_until : null,
                        token: r.floor_sell_value && {
                            contract: r.floor_sell_token_contract
                                ? (0, utils_1.fromBuffer)(r.floor_sell_token_contract)
                                : null,
                            tokenId: r.floor_sell_token_id,
                            name: r.floor_sell_token_name,
                            image: r.floor_sell_token_image,
                        },
                    },
                    topBid: {
                        id: r.top_buy_id,
                        value: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                        maker: r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null,
                        validFrom: r.top_buy_valid_from,
                        validUntil: r.top_buy_value ? r.top_buy_valid_until : null,
                    },
                    rank: {
                        "1day": r.day1_rank,
                        "7day": r.day7_rank,
                        "30day": r.day30_rank,
                        allTime: r.all_time_rank,
                    },
                    volume: {
                        "1day": r.day1_volume ? (0, utils_1.formatEth)(r.day1_volume) : null,
                        "7day": r.day7_volume ? (0, utils_1.formatEth)(r.day7_volume) : null,
                        "30day": r.day30_volume ? (0, utils_1.formatEth)(r.day30_volume) : null,
                        allTime: r.all_time_volume ? (0, utils_1.formatEth)(r.all_time_volume) : null,
                    },
                });
            return { collection: result };
        }
        catch (error) {
            logger_1.logger.error(`get-collection-deprecated-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map