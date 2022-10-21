"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionsV4Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const collection_sets_1 = require("@/models/collection-sets");
const version = "v4";
exports.getCollectionsV4Options = {
    cache: {
        privacy: "public",
        expiresIn: 10000,
    },
    description: "Collections",
    notes: "Useful for getting multiple collections to show in a marketplace, or search for particular collections.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection set."),
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community. Example: `artblocks`"),
            contract: joi_1.default.alternatives()
                .try(joi_1.default.array()
                .items(joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/))
                .max(20), joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/))
                .description("Array of contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            name: joi_1.default.string()
                .lowercase()
                .description("Search for collections that match a string. Example: `bored`"),
            slug: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection slug. Example: `boredapeyachtclub`"),
            sortBy: joi_1.default.string()
                .valid("1DayVolume", "7DayVolume", "30DayVolume", "allTimeVolume")
                .default("allTimeVolume")
                .description("Order the items are returned in the response."),
            includeTopBid: joi_1.default.boolean()
                .default(false)
                .description("If true, top bid will be returned in the response."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(20)
                .default(20)
                .description("Amount of items returned in response."),
            continuation: joi_1.default.string().description("Use continuation token to request next offset of items."),
        }).or("collectionsSetId", "community", "contract", "name", "sortBy"),
    },
    response: {
        schema: joi_1.default.object({
            continuation: joi_1.default.string().allow(null),
            collections: joi_1.default.array().items(joi_1.default.object({
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
                floorSaleChange: {
                    "1day": joi_1.default.number().unsafe().allow(null),
                    "7day": joi_1.default.number().unsafe().allow(null),
                    "30day": joi_1.default.number().unsafe().allow(null),
                },
            })),
        }).label(`getCollections${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collections-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        let collections = [];
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          collections.id,
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
          collections.floor_sell_value,
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
          collections.day1_floor_sell_value,
          collections.day7_floor_sell_value,
          collections.day30_floor_sell_value
        FROM collections
      `;
            // Filters
            const conditions = [];
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
            if (query.contract) {
                if (!lodash_1.default.isArray(query.contract)) {
                    query.contract = [query.contract];
                }
                for (const contract of query.contract) {
                    const contractsFilter = `'${lodash_1.default.replace(contract, "0x", "\\x")}'`;
                    if (lodash_1.default.isUndefined(query.contractsFilter)) {
                        query.contractsFilter = [];
                    }
                    query.contractsFilter.push(contractsFilter);
                }
                query.contractsFilter = lodash_1.default.join(query.contractsFilter, ",");
                conditions.push(`collections.contract IN ($/contractsFilter:raw/)`);
            }
            if (query.name) {
                query.name = `%${query.name}%`;
                conditions.push(`collections.name ILIKE $/name/`);
            }
            if (query.slug) {
                conditions.push(`collections.slug = $/slug/`);
            }
            let orderBy = ` ORDER BY collections.all_time_volume DESC`;
            // Sorting
            switch (query.sortBy) {
                case "1DayVolume":
                    if (query.continuation) {
                        conditions.push(`collections.day1_volume < $/continuation/`);
                    }
                    orderBy = ` ORDER BY collections.day1_volume DESC`;
                    break;
                case "7DayVolume":
                    if (query.continuation) {
                        conditions.push(`collections.day7_volume < $/continuation/`);
                    }
                    orderBy = ` ORDER BY collections.day7_volume DESC`;
                    break;
                case "30DayVolume":
                    if (query.continuation) {
                        conditions.push(`collections.day30_volume < $/continuation/`);
                    }
                    orderBy = ` ORDER BY collections.day30_volume DESC`;
                    break;
                case "allTimeVolume":
                default:
                    if (query.continuation) {
                        conditions.push(`collections.all_time_volume < $/continuation/`);
                    }
                    break;
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            baseQuery += orderBy;
            // Pagination
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
            }
            baseQuery = `
        WITH x AS (${baseQuery})
        SELECT *
        FROM x
        ${topBidQuery}
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, query);
            if (result) {
                collections = result.map((r) => {
                    var _a;
                    const response = {
                        id: r.id,
                        slug: r.slug,
                        name: r.name,
                        image: r.image || (((_a = r.sample_images) === null || _a === void 0 ? void 0 : _a.length) ? r.sample_images[0] : null),
                        banner: r.banner,
                        discordUrl: r.discord_url,
                        externalUrl: r.external_url,
                        twitterUsername: r.twitter_username,
                        description: r.description,
                        sampleImages: r.sample_images || [],
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
                        floorSaleChange: {
                            "1day": Number(r.day1_floor_sell_value)
                                ? Number(r.floor_sell_value) / Number(r.day1_floor_sell_value)
                                : null,
                            "7day": Number(r.day7_floor_sell_value)
                                ? Number(r.floor_sell_value) / Number(r.day7_floor_sell_value)
                                : null,
                            "30day": Number(r.day30_floor_sell_value)
                                ? Number(r.floor_sell_value) / Number(r.day30_floor_sell_value)
                                : null,
                        },
                    };
                    if (query.includeTopBid) {
                        response.topBidValue = r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null;
                        response.topBidMaker = r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null;
                    }
                    return response;
                });
            }
            // Set the continuation
            let continuation = null;
            if (result.length === query.limit) {
                const lastCollection = lodash_1.default.last(result);
                if (lastCollection) {
                    switch (query.sortBy) {
                        case "1DayVolume":
                            continuation = lastCollection.day1_volume;
                            break;
                        case "7DayVolume":
                            continuation = lastCollection.day7_volume;
                            break;
                        case "30DayVolume":
                            continuation = lastCollection.day30_volume;
                            break;
                        case "allTimeVolume":
                        default:
                            continuation = lastCollection.all_time_volume;
                            break;
                    }
                }
            }
            return { collections, continuation };
        }
        catch (error) {
            logger_1.logger.error(`get-collections-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v4.js.map