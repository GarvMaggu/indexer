"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getCollectionsV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 60000,
    },
    description: "List of collections",
    notes: "Useful for getting multiple collections to show in a marketplace, or search for particular collections.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community, e.g. `artblocks`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular contract, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            name: joi_1.default.string()
                .lowercase()
                .description("Search for collections that match a string, e.g. `bored`"),
            slug: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular slug, e.g. `boredapeyachtclub`"),
            sortBy: joi_1.default.string().valid("1DayVolume", "allTimeVolume").default("allTimeVolume"),
            offset: joi_1.default.number().integer().min(0).max(10000).default(0),
            limit: joi_1.default.number().integer().min(1).max(20).default(20),
        }).or("community", "contract", "name", "sortBy"),
    },
    response: {
        schema: joi_1.default.object({
            collections: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string(),
                slug: joi_1.default.string().allow(null, ""),
                name: joi_1.default.string().allow(null, ""),
                metadata: joi_1.default.object().allow(null),
                sampleImages: joi_1.default.array().items(joi_1.default.string().allow(null, "")),
                tokenCount: joi_1.default.string(),
                tokenSetId: joi_1.default.string().allow(null),
                royalties: joi_1.default.object({
                    recipient: joi_1.default.string().allow(null, ""),
                    bps: joi_1.default.number(),
                }),
                floorAskPrice: joi_1.default.number().unsafe().allow(null),
                topBidValue: joi_1.default.number().unsafe().allow(null),
                topBidMaker: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/)
                    .allow(null),
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
            })),
        }).label(`getCollections${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collections-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          collections.id,
          collections.slug,
          collections.name,
          collections.metadata,
          collections.royalties,
          collections.token_set_id,
          collections.token_count,
          (
            SELECT array(
              SELECT tokens.image FROM tokens
              WHERE tokens.collection_id = collections.id
              LIMIT 4
            )
          ) AS sample_images,
          (
            SELECT MIN(tokens.floor_sell_value) FROM tokens
            WHERE tokens.collection_id = collections.id
          ) AS floor_sell_value,
          collections.day1_rank,
          collections.day1_volume,
          collections.day7_rank,
          collections.day7_volume,
          collections.day30_rank,
          collections.day30_volume,
          collections.all_time_rank,
          collections.all_time_volume
        FROM collections
      `;
            // Filters
            const conditions = [];
            if (query.community) {
                conditions.push(`collections.community = $/community/`);
            }
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`collections.contract = $/contract/`);
            }
            if (query.name) {
                query.name = `%${query.name}%`;
                conditions.push(`collections.name ILIKE $/name/`);
            }
            if (query.slug) {
                conditions.push(`collections.slug = $/slug/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            if (query.sortBy) {
                switch (query.sortBy) {
                    case "1DayVolume":
                        baseQuery += ` ORDER BY collections.day1_volume DESC`;
                        break;
                    case "allTimeVolume":
                    default:
                        baseQuery += ` ORDER BY collections.all_time_volume DESC`;
                        break;
                }
            }
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            baseQuery = `
        WITH x AS (${baseQuery})
        SELECT
          x.*,
          y.*
        FROM x
        LEFT JOIN LATERAL (
          SELECT
            token_sets.top_buy_value,
            token_sets.top_buy_maker
          FROM token_sets
          WHERE token_sets.id = x.token_set_id
          ORDER BY token_sets.top_buy_value DESC
          LIMIT 1
        ) y ON TRUE
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => ({
                id: r.id,
                slug: r.slug,
                name: r.name,
                metadata: r.metadata,
                sampleImages: r.sample_images || [],
                tokenCount: String(r.token_count),
                tokenSetId: r.token_set_id,
                royalties: r.royalties ? r.royalties[0] : null,
                floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                topBidValue: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                topBidMaker: r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null,
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
            })));
            return { collections: result };
        }
        catch (error) {
            logger_1.logger.error(`get-collections-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map