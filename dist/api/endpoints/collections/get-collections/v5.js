"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionsV5Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const joi_2 = require("@/common/joi");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const collection_sets_1 = require("@/models/collection-sets");
const sources_1 = require("@/models/sources");
const assets_1 = require("@/utils/assets");
const version = "v5";
exports.getCollectionsV5Options = {
    cache: {
        privacy: "public",
        expiresIn: 10000,
    },
    description: "Collections",
    notes: "Useful for getting multiple collections to show in a marketplace, or search for particular collections.",
    tags: ["api", "Collections"],
    plugins: {
        "hapi-swagger": {
            order: 3,
        },
    },
    validate: {
        query: joi_1.default.object({
            id: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            slug: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection slug. Example: `boredapeyachtclub`"),
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection set."),
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community. Example: `artblocks`"),
            contract: joi_1.default.alternatives()
                .try(joi_1.default.array().items(joi_1.default.string().lowercase().pattern(utils_1.regex.address)).max(20), joi_1.default.string().lowercase().pattern(utils_1.regex.address))
                .description("Array of contracts. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            name: joi_1.default.string()
                .lowercase()
                .description("Search for collections that match a string. Example: `bored`"),
            includeTopBid: joi_1.default.boolean()
                .default(false)
                .description("If true, top bid will be returned in the response."),
            includeAttributes: joi_1.default.boolean()
                .when("id", { is: joi_1.default.exist(), then: joi_1.default.allow(), otherwise: joi_1.default.forbidden() })
                .description("If true, attributes will be included in the response. (supported only when filtering to a particular collection using `id`)"),
            includeOwnerCount: joi_1.default.boolean()
                .when("id", { is: joi_1.default.exist(), then: joi_1.default.allow(), otherwise: joi_1.default.forbidden() })
                .description("If true, owner count will be included in the response. (supported only when filtering to a particular collection using `id`)"),
            sortBy: joi_1.default.string()
                .valid("1DayVolume", "7DayVolume", "30DayVolume", "allTimeVolume", "createdAt", "floorAskPrice")
                .default("allTimeVolume")
                .description("Order the items are returned in the response."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(20)
                .default(20)
                .description("Amount of items returned in response."),
            continuation: joi_1.default.string().description("Use continuation token to request next offset of items."),
        }).oxor("id", "slug", "name", "collectionsSetId", "community", "contract"),
    },
    response: {
        schema: joi_1.default.object({
            continuation: joi_1.default.string().allow(null),
            collections: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string(),
                slug: joi_1.default.string().allow(null, "").description("Open Sea slug"),
                createdAt: joi_1.default.string(),
                name: joi_1.default.string().allow(null, ""),
                image: joi_1.default.string().allow(null, ""),
                banner: joi_1.default.string().allow(null, ""),
                discordUrl: joi_1.default.string().allow(null, ""),
                externalUrl: joi_1.default.string().allow(null, ""),
                twitterUsername: joi_1.default.string().allow(null, ""),
                openseaVerificationStatus: joi_1.default.string().allow(null, ""),
                description: joi_1.default.string().allow(null, ""),
                sampleImages: joi_1.default.array().items(joi_1.default.string().allow(null, "")),
                tokenCount: joi_1.default.string(),
                onSaleCount: joi_1.default.string(),
                primaryContract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                tokenSetId: joi_1.default.string().allow(null),
                royalties: joi_1.default.object({
                    recipient: joi_1.default.string().allow(null, ""),
                    bps: joi_1.default.number(),
                }).allow(null),
                lastBuy: {
                    value: joi_1.default.number().unsafe().allow(null),
                    timestamp: joi_1.default.number().allow(null),
                },
                floorAsk: {
                    id: joi_1.default.string().allow(null),
                    sourceDomain: joi_1.default.string().allow(null, ""),
                    price: joi_2.JoiPrice.allow(null),
                    maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                    validFrom: joi_1.default.number().unsafe().allow(null),
                    validUntil: joi_1.default.number().unsafe().allow(null),
                    token: joi_1.default.object({
                        contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                        tokenId: joi_1.default.string().pattern(utils_1.regex.number).allow(null),
                        name: joi_1.default.string().allow(null),
                        image: joi_1.default.string().allow(null, ""),
                    }).allow(null),
                },
                topBid: joi_1.default.object({
                    id: joi_1.default.string().allow(null),
                    sourceDomain: joi_1.default.string().allow(null, ""),
                    price: joi_2.JoiPrice.allow(null),
                    maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                    validFrom: joi_1.default.number().unsafe().allow(null),
                    validUntil: joi_1.default.number().unsafe().allow(null),
                }).optional(),
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
                collectionBidSupported: joi_1.default.boolean(),
                ownerCount: joi_1.default.number().optional(),
                attributes: joi_1.default.array()
                    .items(joi_1.default.object({
                    key: joi_1.default.string().allow(null, ""),
                    kind: joi_1.default.string().allow(null, ""),
                    count: joi_1.default.number().allow(null, ""),
                }))
                    .optional(),
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
            // Include top bid
            let topBidSelectQuery = "";
            let topBidJoinQuery = "";
            if (query.includeTopBid) {
                topBidSelectQuery += `, u.*`;
                topBidJoinQuery = `LEFT JOIN LATERAL (
          SELECT
            token_sets.top_buy_id,
            token_sets.top_buy_maker,
            DATE_PART('epoch', LOWER(orders.valid_between)) AS top_buy_valid_from,
            COALESCE(
              NULLIF(DATE_PART('epoch', UPPER(orders.valid_between)), 'Infinity'),
              0
            ) AS top_buy_valid_until,
            token_sets.last_buy_value,
            token_sets.last_buy_timestamp,
            orders.currency AS top_buy_currency,
            orders.price AS top_buy_price,
            orders.value AS top_buy_value,
            orders.currency_price AS top_buy_currency_price,
            orders.source_id_int AS top_buy_source_id_int,
            orders.currency_value AS top_buy_currency_value
          FROM token_sets
          LEFT JOIN orders
            ON token_sets.top_buy_id = orders.id
          WHERE token_sets.collection_id = x.id
          ORDER BY token_sets.top_buy_value DESC NULLS LAST
          LIMIT 1
        ) u ON TRUE`;
            }
            // Include attributes
            let attributesSelectQuery = "";
            let attributesJoinQuery = "";
            if (query.includeAttributes) {
                attributesSelectQuery = ", w.*";
                attributesJoinQuery = `
          LEFT JOIN LATERAL (
            SELECT
              array_agg(
                json_build_object(
                  'key', key,
                  'kind', kind,
                  'count', attribute_count,
                  'rank', rank
                )
              ) AS attributes
            FROM attribute_keys
              WHERE attribute_keys.collection_id = x.id
            GROUP BY attribute_keys.collection_id
          ) w ON TRUE
        `;
            }
            // Include owner count
            let ownerCountSelectQuery = "";
            let ownerCountJoinQuery = "";
            if (query.includeOwnerCount) {
                ownerCountSelectQuery = ", z.*";
                ownerCountJoinQuery = `
          LEFT JOIN LATERAL (
            SELECT
              COUNT(DISTINCT(owner)) AS owner_count
            FROM nft_balances
            WHERE nft_balances.contract = x.contract
              AND nft_balances.token_id <@ x.token_id_range
            AND amount > 0
          ) z ON TRUE
        `;
            }
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
          (collections.metadata ->> 'safelistRequestStatus')::TEXT AS "opensea_verification_status",
          collections.royalties,
          collections.contract,
          collections.token_id_range,
          collections.token_set_id,
          collections.day1_rank,
          collections.day1_volume,
          collections.day7_rank,
          collections.day7_volume,
          collections.day30_rank,
          collections.day30_volume,
          collections.all_time_rank,
          collections.all_time_volume,
          collections.day1_volume_change,
          collections.day7_volume_change,
          collections.day30_volume_change,
          collections.day1_floor_sell_value,
          collections.day7_floor_sell_value,
          collections.day30_floor_sell_value,
          collections.floor_sell_value,
          collections.token_count,
          collections.created_at,
          (
            SELECT
              COUNT(*)
            FROM tokens
            WHERE tokens.collection_id = collections.id
              AND tokens.floor_sell_value IS NOT NULL
          ) AS on_sale_count,
          ARRAY(
            SELECT
              tokens.image
            FROM tokens
            WHERE tokens.collection_id = collections.id
              AND tokens.image IS NOT NULL
            LIMIT 4
          ) AS sample_images
        FROM collections
      `;
            // Filtering
            const conditions = [];
            if (query.id) {
                conditions.push("collections.id = $/id/");
            }
            if (query.slug) {
                conditions.push("collections.slug = $/slug/");
            }
            if (query.community) {
                conditions.push("collections.community = $/community/");
            }
            if (query.collectionsSetId) {
                query.collectionsIds = await collection_sets_1.CollectionSets.getCollectionsIds(query.collectionsSetId);
                if (lodash_1.default.isEmpty(query.collectionsIds)) {
                    throw Boom.badRequest(`No collections for collection set ${query.collectionsSetId}`);
                }
                conditions.push(`collections.id IN ($/collectionsIds:csv/)`);
            }
            if (query.contract) {
                if (!Array.isArray(query.contract)) {
                    query.contract = [query.contract];
                }
                query.contract = query.contract.map((contract) => (0, utils_1.toBuffer)(contract));
                conditions.push(`collections.contract IN ($/contract:csv/)`);
            }
            if (query.name) {
                query.name = `%${query.name}%`;
                conditions.push(`collections.name ILIKE $/name/`);
            }
            // Sorting and pagination
            if (query.continuation) {
                const [contParam, contId] = lodash_1.default.split((0, utils_1.splitContinuation)(query.continuation)[0], "_");
                query.contParam = contParam;
                query.contId = contId;
            }
            let orderBy = "";
            switch (query.sortBy) {
                case "1DayVolume": {
                    if (query.continuation) {
                        conditions.push(`(collections.day1_volume, collections.id) < ($/contParam/, $/contId/)`);
                    }
                    orderBy = ` ORDER BY collections.day1_volume DESC, collections.id DESC`;
                    break;
                }
                case "7DayVolume": {
                    if (query.continuation) {
                        conditions.push(`(collections.day7_volume, collections.id) < ($/contParam/, $/contId/)`);
                    }
                    orderBy = ` ORDER BY collections.day7_volume DESC, collections.id DESC`;
                    break;
                }
                case "30DayVolume": {
                    if (query.continuation) {
                        conditions.push(`(collections.day30_volume, collections.id) < ($/contParam/, $/contId/)`);
                    }
                    orderBy = ` ORDER BY collections.day30_volume DESC, collections.id DESC`;
                    break;
                }
                case "createdAt": {
                    if (query.continuation) {
                        conditions.push(`(collections.created_at, collections.id) < ($/contParam/, $/contId/)`);
                    }
                    orderBy = ` ORDER BY collections.created_at DESC, collections.id DESC`;
                    break;
                }
                case "floorAskPrice": {
                    if (query.continuation) {
                        conditions.push(`(collections.floor_sell_value, collections.id) < ($/contParam/, $/contId/)`);
                    }
                    orderBy = ` ORDER BY collections.floor_sell_value, collections.id`;
                    break;
                }
                case "allTimeVolume":
                default: {
                    if (query.continuation) {
                        conditions.push(`(collections.all_time_volume, collections.id) < ($/contParam/, $/contId/)`);
                    }
                    orderBy = ` ORDER BY collections.all_time_volume DESC, collections.id DESC`;
                    break;
                }
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            baseQuery += orderBy;
            baseQuery += ` LIMIT $/limit/`;
            baseQuery = `
        WITH x AS (${baseQuery})
        SELECT
          x.*,
          y.*
          ${ownerCountSelectQuery}
          ${attributesSelectQuery}
          ${topBidSelectQuery}
        FROM x
        LEFT JOIN LATERAL (
          SELECT
            tokens.floor_sell_source_id_int,
            tokens.contract AS floor_sell_token_contract,
            tokens.token_id AS floor_sell_token_id,
            tokens.name AS floor_sell_token_name,
            tokens.image AS floor_sell_token_image,
            tokens.floor_sell_id,
            tokens.floor_sell_value,
            tokens.floor_sell_maker,
            tokens.floor_sell_valid_from,
            tokens.floor_sell_valid_to AS floor_sell_valid_until,
            tokens.floor_sell_currency,
            tokens.floor_sell_currency_value
          FROM tokens
          LEFT JOIN orders
            ON tokens.floor_sell_id = orders.id
          WHERE tokens.collection_id = x.id
          ORDER BY tokens.floor_sell_value
          LIMIT 1
        ) y ON TRUE
        ${ownerCountJoinQuery}
        ${attributesJoinQuery}
        ${topBidJoinQuery}
      `;
            // Any further joins might not preserve sorting
            baseQuery += orderBy.replace(/collections/g, "x");
            const results = await db_1.redb.manyOrNone(baseQuery, query);
            const sources = await sources_1.Sources.getInstance();
            const collections = await Promise.all(results.map(async (r) => {
                var _a, _b, _c, _d, _e, _f, _g, _j;
                // Use default currencies for backwards compatibility with entries
                // that don't have the currencies cached in the tokens table
                const floorAskCurrency = r.floor_sell_currency
                    ? (0, utils_1.fromBuffer)(r.floor_sell_currency)
                    : Sdk.Common.Addresses.Eth[index_1.config.chainId];
                const topBidCurrency = r.top_buy_currency
                    ? (0, utils_1.fromBuffer)(r.top_buy_currency)
                    : Sdk.Common.Addresses.Weth[index_1.config.chainId];
                return {
                    id: r.id,
                    slug: r.slug,
                    createdAt: new Date(r.created_at).toISOString(),
                    name: r.name,
                    image: (_a = r.image) !== null && _a !== void 0 ? _a : (((_b = r.sample_images) === null || _b === void 0 ? void 0 : _b.length) ? assets_1.Assets.getLocalAssetsLink(r.sample_images[0]) : null),
                    banner: r.banner,
                    discordUrl: r.discord_url,
                    externalUrl: r.external_url,
                    twitterUsername: r.twitter_username,
                    openseaVerificationStatus: r.opensea_verification_status,
                    description: r.description,
                    sampleImages: (_c = assets_1.Assets.getLocalAssetsLink(r.sample_images)) !== null && _c !== void 0 ? _c : [],
                    tokenCount: String(r.token_count),
                    onSaleCount: String(r.on_sale_count),
                    primaryContract: (0, utils_1.fromBuffer)(r.contract),
                    tokenSetId: r.token_set_id,
                    royalties: r.royalties ? r.royalties[0] : null,
                    lastBuy: {
                        value: r.last_buy_value ? (0, utils_1.formatEth)(r.last_buy_value) : null,
                        timestamp: r.last_buy_timestamp,
                    },
                    floorAsk: {
                        id: r.floor_sell_id,
                        sourceDomain: (_d = sources.get(r.floor_sell_source_id_int)) === null || _d === void 0 ? void 0 : _d.domain,
                        price: r.floor_sell_id
                            ? await (0, joi_2.getJoiPriceObject)({
                                gross: {
                                    amount: (_e = r.floor_sell_currency_value) !== null && _e !== void 0 ? _e : r.floor_sell_value,
                                    nativeAmount: r.floor_sell_value,
                                },
                            }, floorAskCurrency)
                            : null,
                        maker: r.floor_sell_maker ? (0, utils_1.fromBuffer)(r.floor_sell_maker) : null,
                        validFrom: r.floor_sell_valid_from,
                        validUntil: r.floor_sell_value ? r.floor_sell_valid_until : null,
                        token: r.floor_sell_value && {
                            contract: r.floor_sell_token_contract
                                ? (0, utils_1.fromBuffer)(r.floor_sell_token_contract)
                                : null,
                            tokenId: r.floor_sell_token_id,
                            name: r.floor_sell_token_name,
                            image: assets_1.Assets.getLocalAssetsLink(r.floor_sell_token_image),
                        },
                    },
                    topBid: query.includeTopBid
                        ? {
                            id: r.top_buy_id,
                            sourceDomain: (_f = sources.get(r.top_buy_source_id_int)) === null || _f === void 0 ? void 0 : _f.domain,
                            price: r.top_buy_id
                                ? await (0, joi_2.getJoiPriceObject)({
                                    net: {
                                        amount: (_g = r.top_buy_currency_value) !== null && _g !== void 0 ? _g : r.top_buy_value,
                                        nativeAmount: r.top_buy_value,
                                    },
                                    gross: {
                                        amount: (_j = r.top_buy_currency_price) !== null && _j !== void 0 ? _j : r.top_buy_price,
                                        nativeAmount: r.top_buy_price,
                                    },
                                }, topBidCurrency)
                                : null,
                            maker: r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null,
                            validFrom: r.top_buy_valid_from,
                            validUntil: r.top_buy_value ? r.top_buy_valid_until : null,
                        }
                        : undefined,
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
                    collectionBidSupported: Number(r.token_count) <= index_1.config.maxTokenSetSize,
                    ownerCount: query.includeOwnerCount ? Number(r.owner_count) : undefined,
                    attributes: query.includeAttributes
                        ? lodash_1.default.map(lodash_1.default.sortBy(r.attributes, ["rank", "key"]), (attribute) => ({
                            key: attribute.key,
                            kind: attribute.kind,
                            count: Number(attribute.count),
                        }))
                        : undefined,
                };
            }));
            // Pagination
            let continuation = null;
            if (results.length >= query.limit) {
                const lastCollection = lodash_1.default.last(results);
                if (lastCollection) {
                    switch (query.sortBy) {
                        case "1DayVolume": {
                            continuation = (0, utils_1.buildContinuation)(`${lastCollection.day1_volume}_${lastCollection.id}`);
                            break;
                        }
                        case "7DayVolume": {
                            continuation = (0, utils_1.buildContinuation)(`${lastCollection.day7_volume}_${lastCollection.id}`);
                            break;
                        }
                        case "30DayVolume": {
                            continuation = (0, utils_1.buildContinuation)(`${lastCollection.day30_volume}_${lastCollection.id}`);
                            break;
                        }
                        case "createdAt": {
                            continuation = (0, utils_1.buildContinuation)(`${new Date(lastCollection.created_at).toISOString()}_${lastCollection.id}`);
                            break;
                        }
                        case "floorAskPrice": {
                            continuation = (0, utils_1.buildContinuation)(`${lastCollection.floor_sell_value}_${lastCollection.id}`);
                            break;
                        }
                        case "allTimeVolume":
                        default: {
                            continuation = (0, utils_1.buildContinuation)(`${lastCollection.all_time_volume}_${lastCollection.id}`);
                            break;
                        }
                    }
                }
            }
            return {
                collections,
                continuation: continuation ? continuation : undefined,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-collections-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v5.js.map