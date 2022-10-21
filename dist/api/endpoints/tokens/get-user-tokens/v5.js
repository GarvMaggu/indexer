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
exports.getUserTokensV5Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const collection_sets_1 = require("@/models/collection-sets");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const index_1 = require("@/config/index");
const joi_2 = require("@/common/joi");
const sources_1 = require("@/models/sources");
const lodash_1 = __importDefault(require("lodash"));
const version = "v5";
exports.getUserTokensV5Options = {
    cache: {
        privacy: "public",
        expiresIn: 60000,
    },
    description: "User Tokens",
    notes: "Get tokens held by a user, along with ownership information such as associated orders and date acquired.",
    tags: ["api", "Tokens"],
    plugins: {
        "hapi-swagger": {
            order: 9,
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
                .description("Filter to a particular community, e.g. `artblocks`"),
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection set."),
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular contract, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            tokens: joi_1.default.alternatives().try(joi_1.default.array()
                .max(50)
                .items(joi_1.default.string().lowercase().pattern(utils_1.regex.token))
                .description("Array of tokens. Example: `tokens[0]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:704 tokens[1]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:979`"), joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Array of tokens. Example: `tokens[0]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:704 tokens[1]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:979`")),
            sortBy: joi_1.default.string()
                .valid("acquiredAt")
                .description("Order the items are returned in the response."),
            sortDirection: joi_1.default.string()
                .lowercase()
                .valid("asc", "desc")
                .default("desc")
                .description("Order the items are returned in the response."),
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
            includeTopBid: joi_1.default.boolean()
                .default(false)
                .description("If true, top bid will be returned in the response."),
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
                        imageUrl: joi_1.default.string().allow(null),
                        floorAskPrice: joi_1.default.number().unsafe().allow(null),
                    }),
                    topBid: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        price: joi_2.JoiPrice.allow(null),
                    }).optional(),
                }),
                ownership: joi_1.default.object({
                    tokenCount: joi_1.default.string(),
                    onSaleCount: joi_1.default.string(),
                    floorAsk: {
                        id: joi_1.default.string().allow(null),
                        price: joi_2.JoiPrice.allow(null),
                        maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                        validFrom: joi_1.default.number().unsafe().allow(null),
                        validUntil: joi_1.default.number().unsafe().allow(null),
                        source: joi_1.default.object().allow(null),
                    },
                    acquiredAt: joi_1.default.string().allow(null),
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
        // Filters
        params.user = (0, utils_1.toBuffer)(params.user);
        params.offset = query.offset;
        params.limit = query.limit;
        const collectionFilters = [];
        const addCollectionToFilter = (id) => {
            const i = collectionFilters.length;
            if (id.match(/^0x[a-f0-9]{40}:\d+:\d+$/g)) {
                const [contract, startTokenId, endTokenId] = id.split(":");
                query[`contract${i}`] = (0, utils_1.toBuffer)(contract);
                query[`startTokenId${i}`] = startTokenId;
                query[`endTokenId${i}`] = endTokenId;
                collectionFilters.push(`
          (nft_balances.contract = $/contract${i}/
          AND nft_balances.token_id >= $/startTokenId${i}/
          AND nft_balances.token_id <= $/endTokenId${i}/)
        `);
            }
            else {
                query[`contract${i}`] = (0, utils_1.toBuffer)(id);
                collectionFilters.push(`(nft_balances.contract = $/contract${i}/)`);
            }
        };
        if (query.community) {
            await db_1.redb
                .manyOrNone(`
          SELECT collections.id FROM collections
          WHERE collections.community = $/community/
        `, { community: query.community })
                .then((result) => result.forEach(({ id }) => addCollectionToFilter(id)));
            if (!collectionFilters.length) {
                return { tokens: [] };
            }
        }
        if (query.collectionsSetId) {
            await collection_sets_1.CollectionSets.getCollectionsIds(query.collectionsSetId).then((result) => result.forEach(addCollectionToFilter));
            if (!collectionFilters.length) {
                return { tokens: [] };
            }
        }
        if (query.collection) {
            addCollectionToFilter(query.collection);
        }
        const tokensFilter = [];
        if (query.tokens) {
            if (!lodash_1.default.isArray(query.tokens)) {
                query.tokens = [query.tokens];
            }
            for (const token of query.tokens) {
                const [contract, tokenId] = token.split(":");
                const tokenFilter = `('${lodash_1.default.replace(contract, "0x", "\\x")}', '${tokenId}')`;
                tokensFilter.push(tokenFilter);
            }
            query.tokensFilter = lodash_1.default.join(tokensFilter, ",");
        }
        let sortByFilter = "";
        switch (query.sortBy) {
            case "acquiredAt": {
                sortByFilter = `
            ORDER BY
              b.acquired_at ${query.sortDirection}
          `;
                break;
            }
        }
        let tokensJoin = `
      JOIN LATERAL (
        SELECT 
          t.token_id,
          t.name,
          t.image,
          t.collection_id,
          t.floor_sell_id,
          t.floor_sell_value,
          t.floor_sell_currency,
          t.floor_sell_currency_value,
          t.floor_sell_maker,
          t.floor_sell_valid_from,
          t.floor_sell_valid_to,
          t.floor_sell_source_id_int,
          null AS top_bid_id,
          null AS top_bid_price,
          null AS top_bid_value,
          null AS top_bid_currency,
          null AS top_bid_currency_price,
          null AS top_bid_currency_value
        FROM tokens t
        WHERE b.token_id = t.token_id
        AND b.contract = t.contract
      ) t ON TRUE
    `;
        if (query.includeTopBid) {
            tokensJoin = `
        JOIN LATERAL (
          SELECT 
            t.token_id,
            t.name,
            t.image,
            t.collection_id,
            t.floor_sell_id,
            t.floor_sell_value,
            t.floor_sell_currency,
            t.floor_sell_currency_value,
            t.floor_sell_maker,
            t.floor_sell_valid_from,
            t.floor_sell_valid_to,
            t.floor_sell_source_id_int
          FROM tokens t
          WHERE b.token_id = t.token_id
          AND b.contract = t.contract
        ) t ON TRUE
        LEFT JOIN LATERAL (
          SELECT 
            o.id AS "top_bid_id",
            o.price AS "top_bid_price",
            o.value AS "top_bid_value",
            o.currency AS "top_bid_currency",
            o.currency_price AS "top_bid_currency_price",
            o.currency_value AS "top_bid_currency_value"
          FROM "orders" "o"
          JOIN "token_sets_tokens" "tst" ON "o"."token_set_id" = "tst"."token_set_id"
          WHERE "tst"."contract" = "b"."contract"
          AND "tst"."token_id" = "b"."token_id"
          AND "o"."side" = 'buy'
          AND "o"."fillability_status" = 'fillable'
          AND "o"."approval_status" = 'approved'
          AND EXISTS(
            SELECT FROM "nft_balances" "nb"
              WHERE "nb"."contract" = "b"."contract"
              AND "nb"."token_id" = "b"."token_id"
              AND "nb"."amount" > 0
              AND "nb"."owner" != "o"."maker"
          )
          ORDER BY "o"."value" DESC
          LIMIT 1
        ) "y" ON TRUE
      `;
        }
        try {
            const baseQuery = `
        SELECT b.contract, b.token_id, b.token_count, b.acquired_at,
               t.name, t.image, t.collection_id, t.floor_sell_id, t.floor_sell_value, t.floor_sell_currency, t.floor_sell_currency_value,
               t.floor_sell_maker, t.floor_sell_valid_from, t.floor_sell_valid_to, t.floor_sell_source_id_int,
               top_bid_id, top_bid_price, top_bid_value, top_bid_currency, top_bid_currency_price, top_bid_currency_value,
               c.name as collection_name, c.metadata, c.floor_sell_value AS "collection_floor_sell_value",
               (
                    CASE WHEN t.floor_sell_value IS NOT NULL
                    THEN 1
                    ELSE 0
                    END
               ) AS on_sale_count
        FROM (
            SELECT amount AS token_count, token_id, contract, acquired_at
            FROM nft_balances
            WHERE owner = $/user/
              AND ${collectionFilters.length ? "(" + collectionFilters.join(" OR ") + ")" : "TRUE"}
              AND ${tokensFilter.length
                ? "(nft_balances.contract, nft_balances.token_id) IN ($/tokensFilter:raw/)"
                : "TRUE"}
              AND amount > 0
          ) AS b
          ${tokensJoin}
          JOIN collections c ON c.id = t.collection_id
        ${sortByFilter}
        OFFSET $/offset/
        LIMIT $/limit/
      `;
            const userTokens = await db_1.redb.manyOrNone(baseQuery, { ...query, ...params });
            const sources = await sources_1.Sources.getInstance();
            const result = userTokens.map(async (r) => {
                var _a, _b, _c, _d;
                const contract = (0, utils_1.fromBuffer)(r.contract);
                const tokenId = r.token_id;
                // Use default currencies for backwards compatibility with entries
                // that don't have the currencies cached in the tokens table
                const floorAskCurrency = r.floor_sell_currency
                    ? (0, utils_1.fromBuffer)(r.floor_sell_currency)
                    : Sdk.Common.Addresses.Eth[index_1.config.chainId];
                const topBidCurrency = r.top_bid_currency
                    ? (0, utils_1.fromBuffer)(r.top_bid_currency)
                    : Sdk.Common.Addresses.Weth[index_1.config.chainId];
                const floorSellSource = r.floor_sell_value
                    ? sources.get(Number(r.floor_sell_source_id_int), contract, tokenId)
                    : undefined;
                return {
                    token: {
                        contract: contract,
                        tokenId: tokenId,
                        name: r.name,
                        image: r.image,
                        collection: {
                            id: r.collection_id,
                            name: r.collection_name,
                            imageUrl: (_a = r.metadata) === null || _a === void 0 ? void 0 : _a.imageUrl,
                            floorAskPrice: r.collection_floor_sell_value
                                ? (0, utils_1.formatEth)(r.collection_floor_sell_value)
                                : null,
                        },
                        topBid: query.includeTopBid
                            ? {
                                id: r.top_bid_id,
                                price: r.top_bid_value
                                    ? await (0, joi_2.getJoiPriceObject)({
                                        net: {
                                            amount: (_b = r.top_bid_currency_value) !== null && _b !== void 0 ? _b : r.top_bid_value,
                                            nativeAmount: r.top_bid_value,
                                        },
                                        gross: {
                                            amount: (_c = r.top_bid_currency_price) !== null && _c !== void 0 ? _c : r.top_bid_price,
                                            nativeAmount: r.top_bid_price,
                                        },
                                    }, topBidCurrency)
                                    : null,
                            }
                            : undefined,
                    },
                    ownership: {
                        tokenCount: String(r.token_count),
                        onSaleCount: String(r.on_sale_count),
                        floorAsk: {
                            id: r.floor_sell_id,
                            price: r.floor_sell_id
                                ? await (0, joi_2.getJoiPriceObject)({
                                    gross: {
                                        amount: (_d = r.floor_sell_currency_value) !== null && _d !== void 0 ? _d : r.floor_sell_value,
                                        nativeAmount: r.floor_sell_value,
                                    },
                                }, floorAskCurrency)
                                : null,
                            maker: r.floor_sell_maker ? (0, utils_1.fromBuffer)(r.floor_sell_maker) : null,
                            validFrom: r.floor_sell_value ? r.floor_sell_valid_from : null,
                            validUntil: r.floor_sell_value ? r.floor_sell_valid_to : null,
                            source: {
                                id: floorSellSource === null || floorSellSource === void 0 ? void 0 : floorSellSource.address,
                                domain: floorSellSource === null || floorSellSource === void 0 ? void 0 : floorSellSource.domain,
                                name: (floorSellSource === null || floorSellSource === void 0 ? void 0 : floorSellSource.metadata.title) || (floorSellSource === null || floorSellSource === void 0 ? void 0 : floorSellSource.name),
                                icon: floorSellSource === null || floorSellSource === void 0 ? void 0 : floorSellSource.metadata.icon,
                                url: floorSellSource === null || floorSellSource === void 0 ? void 0 : floorSellSource.metadata.url,
                            },
                        },
                        acquiredAt: r.acquired_at ? new Date(r.acquired_at).toISOString() : null,
                    },
                };
            });
            return { tokens: await Promise.all(result) };
        }
        catch (error) {
            logger_1.logger.error(`get-user-tokens-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v5.js.map