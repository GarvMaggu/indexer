"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserCollectionsV2Options = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const collection_sets_1 = require("@/models/collection-sets");
const assets_1 = require("@/utils/assets");
const sources_1 = require("@/models/sources");
const version = "v2";
exports.getUserCollectionsV2Options = {
    description: "User collections",
    notes: "Get aggregate stats for a user, grouped by collection. Useful for showing total portfolio information.",
    tags: ["api", "Collections"],
    plugins: {
        "hapi-swagger": {
            order: 3,
        },
    },
    validate: {
        params: joi_1.default.object({
            user: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .required()
                .description("Filter to a particular user. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
        }),
        query: joi_1.default.object({
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community. Example: `artblocks`"),
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection set."),
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            includeTopBid: joi_1.default.boolean()
                .default(false)
                .description("If true, top bid will be returned in the response."),
            includeLiquidCount: joi_1.default.boolean()
                .default(false)
                .description("If true, number of tokens with bids will be returned in the response."),
            offset: joi_1.default.number()
                .integer()
                .min(0)
                .max(10000)
                .default(0)
                .description("Use offset to request the next batch of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(100)
                .default(20)
                .description("Amount of items returned in response."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            collections: joi_1.default.array().items(joi_1.default.object({
                collection: joi_1.default.object({
                    id: joi_1.default.string(),
                    slug: joi_1.default.string().allow(null, ""),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    banner: joi_1.default.string().allow(null, ""),
                    discordUrl: joi_1.default.string().allow(null, ""),
                    externalUrl: joi_1.default.string().allow(null, ""),
                    twitterUsername: joi_1.default.string().allow(null, ""),
                    description: joi_1.default.string().allow(null, ""),
                    sampleImages: joi_1.default.array().items(joi_1.default.string().allow(null, "")),
                    tokenCount: joi_1.default.string(),
                    tokenSetId: joi_1.default.string().allow(null),
                    primaryContract: joi_1.default.string()
                        .lowercase()
                        .pattern(/^0x[a-fA-F0-9]{40}$/),
                    floorAskPrice: joi_1.default.number().unsafe().allow(null),
                    topBidValue: joi_1.default.number().unsafe().allow(null),
                    topBidMaker: joi_1.default.string()
                        .lowercase()
                        .pattern(/^0x[a-fA-F0-9]{40}$/)
                        .allow(null),
                    topBidSourceDomain: joi_1.default.string().allow(null, ""),
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
                    volumeChange: {
                        "1day": joi_1.default.number().unsafe().allow(null),
                        "7day": joi_1.default.number().unsafe().allow(null),
                        "30day": joi_1.default.number().unsafe().allow(null),
                    },
                    floorSale: {
                        "1day": joi_1.default.number().unsafe().allow(null),
                        "7day": joi_1.default.number().unsafe().allow(null),
                        "30day": joi_1.default.number().unsafe().allow(null),
                    },
                }),
                ownership: joi_1.default.object({
                    tokenCount: joi_1.default.string(),
                    onSaleCount: joi_1.default.string(),
                    liquidCount: joi_1.default.string().optional(),
                }),
            })),
        }).label(`getUserCollections${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-collections-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const query = request.query;
        let liquidCount = "";
        let selectLiquidCount = "";
        if (query.includeLiquidCount) {
            selectLiquidCount = "SUM(owner_liquid_count) AS owner_liquid_count,";
            liquidCount = `
        LEFT JOIN LATERAL (
            SELECT 1 AS owner_liquid_count
            FROM "orders" "o"
            JOIN "token_sets_tokens" "tst" ON "o"."token_set_id" = "tst"."token_set_id"
            WHERE "tst"."contract" = nft_balances."contract"
            AND "tst"."token_id" = nft_balances."token_id"
            AND "o"."side" = 'buy'
            AND "o"."fillability_status" = 'fillable'
            AND "o"."approval_status" = 'approved'
            AND EXISTS(
              SELECT FROM "nft_balances" "nb"
                WHERE "nb"."contract" = nft_balances."contract"
                AND "nb"."token_id" = nft_balances."token_id"
                AND "nb"."amount" > 0
                AND "nb"."owner" != "o"."maker"
            )
            LIMIT 1
        ) "y" ON TRUE
      `;
        }
        try {
            let baseQuery = `
        SELECT  collections.id,
                collections.slug,
                collections.name,
                (collections.metadata ->> 'imageUrl')::TEXT AS "image",
                (collections.metadata ->> 'bannerImageUrl')::TEXT AS "banner",
                (collections.metadata ->> 'discordUrl')::TEXT AS "discord_url",
                (collections.metadata ->> 'description')::TEXT AS "description",
                (collections.metadata ->> 'externalUrl')::TEXT AS "external_url",
                (collections.metadata ->> 'twitterUsername')::TEXT AS "twitter_username",
                collections.contract,
                collections.token_set_id,
                collections.token_count,
                (
                  SELECT array(
                    SELECT tokens.image FROM tokens
                    WHERE tokens.collection_id = collections.id
                    AND tokens.image IS NOT NULL
                    LIMIT 4
                  )
                ) AS sample_images,
                collections.day1_volume,
                collections.day7_volume,
                collections.day30_volume,
                collections.all_time_volume,
                collections.day1_rank,
                collections.day7_rank,
                collections.day30_rank,
                collections.all_time_rank,
                collections.day1_volume_change,
                collections.day7_volume_change,
                collections.day30_volume_change,
                collections.floor_sell_value,
                collections.day1_floor_sell_value,
                collections.day7_floor_sell_value,
                collections.day30_floor_sell_value,
                SUM(COALESCE(nft_balances.amount, 0)) AS owner_token_count,
                ${selectLiquidCount}
                SUM(CASE WHEN tokens.floor_sell_value IS NULL THEN 0 ELSE 1 END) AS owner_on_sale_count
        FROM nft_balances 
        JOIN tokens ON nft_balances.contract = tokens.contract AND nft_balances.token_id = tokens.token_id
        ${liquidCount}
        JOIN collections ON tokens.collection_id = collections.id
      `;
            // Filters
            params.user = (0, utils_1.toBuffer)(params.user);
            const conditions = [`nft_balances.owner = $/user/`, `nft_balances.amount > 0`];
            if (query.community) {
                conditions.push(`collections.community = $/community/`);
            }
            if (query.collectionsSetId) {
                const collectionsIds = await collection_sets_1.CollectionSets.getCollectionsIds(query.collectionsSetId);
                if (!lodash_1.default.isEmpty(collectionsIds)) {
                    query.collectionsIds = lodash_1.default.join(collectionsIds, "','");
                    conditions.push(`collections.id IN ('$/collectionsIds:raw/')`);
                }
            }
            if (query.collection) {
                conditions.push(`collections.id = $/collection/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Grouping
            baseQuery += ` GROUP BY collections.id, nft_balances.owner`;
            // Sorting
            baseQuery += ` ORDER BY collections.all_time_volume DESC`;
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            let topBidQuery = "";
            if (query.includeTopBid) {
                topBidQuery = `LEFT JOIN LATERAL (
          SELECT
            token_sets.top_buy_value,
            token_sets.top_buy_maker
          FROM token_sets
          WHERE token_sets.id = x.token_set_id
          ORDER BY token_sets.top_buy_value DESC
          LIMIT 1
        ) y ON TRUE`;
                topBidQuery = `LEFT JOIN LATERAL (
          SELECT
            ts.top_buy_id,
            ts.top_buy_value,
            o.source_id_int AS top_buy_source_id_int,
            ts.top_buy_maker
          FROM token_sets ts
          LEFT JOIN orders o ON ts.top_buy_id = o.id
          WHERE ts.id = x.token_set_id
          ORDER BY ts.top_buy_value DESC NULLS LAST
          LIMIT 1
        ) y ON TRUE`;
            }
            baseQuery = `
        WITH x AS (${baseQuery})
        SELECT *
        FROM x
        ${topBidQuery}
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, { ...params, ...query });
            const sources = await sources_1.Sources.getInstance();
            const collections = lodash_1.default.map(result, (r) => {
                var _a, _b;
                const response = {
                    collection: {
                        id: r.id,
                        slug: r.slug,
                        name: r.name,
                        image: assets_1.Assets.getLocalAssetsLink(r.image) ||
                            (((_a = r.sample_images) === null || _a === void 0 ? void 0 : _a.length) ? assets_1.Assets.getLocalAssetsLink(r.sample_images[0]) : null),
                        banner: r.banner,
                        discordUrl: r.discord_url,
                        externalUrl: r.external_url,
                        twitterUsername: r.twitter_username,
                        description: r.description,
                        sampleImages: assets_1.Assets.getLocalAssetsLink(r.sample_images) || [],
                        tokenCount: String(r.token_count),
                        primaryContract: (0, utils_1.fromBuffer)(r.contract),
                        tokenSetId: r.token_set_id,
                        floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
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
                        volumeChange: {
                            "1day": r.day1_volume_change,
                            "7day": r.day7_volume_change,
                            "30day": r.day30_volume_change,
                        },
                        floorSale: {
                            "1day": r.day1_floor_sell_value ? (0, utils_1.formatEth)(r.day1_floor_sell_value) : null,
                            "7day": r.day7_floor_sell_value ? (0, utils_1.formatEth)(r.day7_floor_sell_value) : null,
                            "30day": r.day30_floor_sell_value ? (0, utils_1.formatEth)(r.day30_floor_sell_value) : null,
                        },
                    },
                    ownership: {
                        tokenCount: String(r.owner_token_count),
                        onSaleCount: String(r.owner_on_sale_count),
                        liquidCount: query.includeLiquidCount
                            ? String(Number(r.owner_liquid_count))
                            : undefined,
                    },
                };
                if (query.includeTopBid) {
                    response.collection.topBidValue = r.top_buy_value
                        ? (0, utils_1.formatEth)(r.top_buy_value)
                        : null;
                    response.collection.topBidMaker = r.top_buy_maker
                        ? (0, utils_1.fromBuffer)(r.top_buy_maker)
                        : null;
                    response.collection.topBidSourceDomain = r.top_buy_source_id_int
                        ? (_b = sources.get(r.top_buy_source_id_int)) === null || _b === void 0 ? void 0 : _b.domain
                        : null;
                }
                return response;
            });
            return { collections };
        }
        catch (error) {
            logger_1.logger.error(`get-user-collections-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map