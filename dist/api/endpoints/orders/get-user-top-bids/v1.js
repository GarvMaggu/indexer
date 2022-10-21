"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserTopBidsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const assets_1 = require("@/utils/assets");
const version = "v1";
exports.getUserTopBidsV1Options = {
    description: "User Top Bids",
    notes: "Return the top bids for the given user tokens",
    tags: ["api", "Orders"],
    plugins: {
        "hapi-swagger": {
            order: 7,
        },
    },
    validate: {
        params: joi_1.default.object({
            user: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular user. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
        }),
        query: joi_1.default.object({
            collection: joi_1.default.alternatives(joi_1.default.string().lowercase(), joi_1.default.array().items(joi_1.default.string().lowercase())).description("Filter to one or more collections. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            optimizeCheckoutURL: joi_1.default.boolean()
                .default(false)
                .description("If true, urls will only be returned for optimized sources that support royalties."),
            continuation: joi_1.default.string().description("Use continuation token to request next offset of items."),
            sortBy: joi_1.default.string()
                .valid("topBidValue", "dateCreated", "orderExpiry")
                .default("topBidValue")
                .description("Order of the items are returned in the response."),
            sortDirection: joi_1.default.string().lowercase().valid("asc", "desc").default("desc"),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(20)
                .default(20)
                .description("Amount of items returned in response."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            totalTokensWithBids: joi_1.default.number(),
            topBids: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string(),
                price: joi_1.default.number().unsafe(),
                value: joi_1.default.number().unsafe(),
                maker: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/),
                createdAt: joi_1.default.string(),
                validFrom: joi_1.default.number().unsafe(),
                validUntil: joi_1.default.number().unsafe(),
                source: joi_1.default.object().allow(null),
                feeBreakdown: joi_1.default.array()
                    .items(joi_1.default.object({
                    kind: joi_1.default.string(),
                    recipient: joi_1.default.string().allow("", null),
                    bps: joi_1.default.number(),
                }))
                    .allow(null),
                context: joi_1.default.alternatives(joi_1.default.object({
                    kind: "token",
                    data: joi_1.default.object({
                        collectionName: joi_1.default.string().allow("", null),
                        tokenName: joi_1.default.string().allow("", null),
                        image: joi_1.default.string().allow("", null),
                    }),
                }), joi_1.default.object({
                    kind: "collection",
                    data: joi_1.default.object({
                        collectionName: joi_1.default.string().allow("", null),
                        image: joi_1.default.string().allow("", null),
                    }),
                }), joi_1.default.object({
                    kind: "attribute",
                    data: joi_1.default.object({
                        collectionName: joi_1.default.string().allow("", null),
                        attributes: joi_1.default.array().items(joi_1.default.object({ key: joi_1.default.string(), value: joi_1.default.string() })),
                        image: joi_1.default.string().allow("", null),
                    }),
                })).allow(null),
                token: joi_1.default.object({
                    contract: joi_1.default.string(),
                    tokenId: joi_1.default.string(),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    floorAskPrice: joi_1.default.number().unsafe().allow(null),
                    lastSalePrice: joi_1.default.number().unsafe().allow(null),
                    collection: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        name: joi_1.default.string().allow(null, ""),
                        imageUrl: joi_1.default.string().allow(null),
                        floorAskPrice: joi_1.default.number().unsafe().allow(null),
                    }),
                }),
            })),
            continuation: joi_1.default.string().allow(null),
        }).label(`getUserTopBids${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-top-bids-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const query = request.query;
        let collectionFilter = "";
        let sortField = "top_bid_value";
        let offset = 0;
        // Set the user value for the query
        query.user = (0, utils_1.toBuffer)(params.user);
        switch (query.sortBy) {
            case "dateCreated":
                sortField = "order_created_at";
                break;
            case "orderExpiry":
                sortField = "top_bid_valid_until";
                break;
            case "topBidValue":
            default:
                break;
        }
        if (query.continuation) {
            offset = Number((0, utils_1.splitContinuation)(query.continuation));
        }
        if (query.collection) {
            if (Array.isArray(query.collection)) {
                collectionFilter = `AND id IN ($/collection:csv/)`;
            }
            else {
                collectionFilter = `AND id = $/collection/`;
            }
        }
        try {
            const baseQuery = `
        SELECT nb.contract, y.*, t.*, c.*, count(*) OVER() AS "total_tokens_with_bids",
               (
                CASE
                  WHEN y.token_set_id LIKE 'token:%' THEN
                      json_build_object(
                        'kind', 'token',
                        'data', json_build_object(
                          'collectionName', c.collection_name,
                          'tokenName', t.name,
                          'image', t.image
                        )
                      )
      
                  WHEN y.token_set_id LIKE 'contract:%' THEN
                      json_build_object(
                        'kind', 'collection',
                        'data', json_build_object(
                          'collectionName', c.collection_name,
                          'image', (c.collection_metadata ->> 'imageUrl')::TEXT
                        )
                      )
      
                  WHEN y.token_set_id LIKE 'range:%' THEN
                      json_build_object(
                        'kind', 'collection',
                        'data', json_build_object(
                          'collectionName', c.collection_name,
                          'image', (c.collection_metadata ->> 'imageUrl')::TEXT
                        )
                      )
                     
                  WHEN y.token_set_id LIKE 'list:%' THEN
                    (SELECT
                      CASE
                        WHEN token_sets.attribute_id IS NULL THEN
                          (SELECT
                            json_build_object(
                              'kind', 'collection',
                              'data', json_build_object(
                                'collectionName', collections.name,
                                'image', (collections.metadata ->> 'imageUrl')::TEXT
                              )
                            )
                          FROM collections
                          WHERE token_sets.collection_id = collections.id)
                        ELSE
                          (SELECT
                            json_build_object(
                              'kind', 'attribute',
                              'data', json_build_object(
                                'collectionName', collections.name,
                                'attributes', ARRAY[json_build_object('key', attribute_keys.key, 'value', attributes.value)],
                                'image', (collections.metadata ->> 'imageUrl')::TEXT
                              )
                            )
                          FROM attributes
                          JOIN attribute_keys
                            ON attributes.attribute_key_id = attribute_keys.id
                          JOIN collections
                            ON attribute_keys.collection_id = collections.id
                          WHERE token_sets.attribute_id = attributes.id)
                      END  
                   FROM token_sets
                   WHERE token_sets.id = y.token_set_id
                   AND token_sets.schema_hash = y.token_set_schema_hash) 
                  ELSE NULL
                END
              ) AS bid_context
        FROM nft_balances nb
        JOIN LATERAL (
            SELECT o.token_set_id, o.id AS "top_bid_id", o.price AS "top_bid_price", o.value AS "top_bid_value",
                   o.maker AS "top_bid_maker", source_id_int, o.created_at "order_created_at", o.token_set_schema_hash,
                   extract(epoch from o.created_at) * 1000000 AS "order_created_at_micro",
                   DATE_PART('epoch', LOWER(o.valid_between)) AS "top_bid_valid_from", o.fee_breakdown,
                   COALESCE(
                     NULLIF(DATE_PART('epoch', UPPER(o.valid_between)), 'Infinity'),
                     0
                   ) AS "top_bid_valid_until"
            FROM orders o
            JOIN token_sets_tokens tst ON o.token_set_id = tst.token_set_id
            WHERE tst.contract = nb.contract
            AND tst.token_id = nb.token_id
            AND o.side = 'buy'
            AND o.fillability_status = 'fillable'
            AND o.approval_status = 'approved'
            AND o.maker != $/user/
            ORDER BY o.value DESC
            LIMIT 1
        ) y ON TRUE
        LEFT JOIN LATERAL (
            SELECT t.token_id, t.name, t.image, t.collection_id, floor_sell_value AS "token_floor_sell_value", last_sell_value AS "token_last_sell_value"
            FROM tokens t
            WHERE t.contract = nb.contract
            AND t.token_id = nb.token_id
        ) t ON TRUE
        ${query.collection ? "" : "LEFT"} JOIN LATERAL (
            SELECT id AS "collection_id", name AS "collection_name", metadata AS "collection_metadata", floor_sell_value AS "collection_floor_sell_value"
            FROM collections c
            WHERE id = t.collection_id
            ${collectionFilter}
        ) c ON TRUE
        WHERE owner = $/user/
        AND amount > 0
        ORDER BY ${sortField} ${query.sortDirection}, token_id ${query.sortDirection}
        OFFSET ${offset} LIMIT $/limit/
      `;
            const sources = await sources_1.Sources.getInstance();
            const bids = await db_1.redb.manyOrNone(baseQuery, query);
            let totalTokensWithBids = 0;
            const results = bids.map((r) => {
                var _a;
                const contract = (0, utils_1.fromBuffer)(r.contract);
                const tokenId = r.token_id;
                totalTokensWithBids = Number(r.total_tokens_with_bids);
                const source = sources.get(Number(r.source_id_int), contract, tokenId, query.optimizeCheckoutURL);
                return {
                    id: r.top_bid_id,
                    price: (0, utils_1.formatEth)(r.top_bid_price),
                    value: (0, utils_1.formatEth)(r.top_bid_value),
                    maker: (0, utils_1.fromBuffer)(r.top_bid_maker),
                    createdAt: new Date(r.order_created_at).toISOString(),
                    validFrom: r.top_bid_valid_from,
                    validUntil: r.top_bid_valid_until,
                    source: {
                        id: source === null || source === void 0 ? void 0 : source.address,
                        domain: source === null || source === void 0 ? void 0 : source.domain,
                        name: (source === null || source === void 0 ? void 0 : source.metadata.title) || (source === null || source === void 0 ? void 0 : source.name),
                        icon: source === null || source === void 0 ? void 0 : source.metadata.icon,
                        url: source === null || source === void 0 ? void 0 : source.metadata.url,
                    },
                    feeBreakdown: r.fee_breakdown,
                    context: r.bid_context,
                    token: {
                        contract: contract,
                        tokenId: tokenId,
                        name: r.name,
                        image: assets_1.Assets.getLocalAssetsLink(r.image),
                        floorAskPrice: r.token_floor_sell_value ? (0, utils_1.formatEth)(r.token_floor_sell_value) : null,
                        lastSalePrice: r.token_last_sell_value ? (0, utils_1.formatEth)(r.token_last_sell_value) : null,
                        collection: {
                            id: r.collection_id,
                            name: r.collection_name,
                            imageUrl: assets_1.Assets.getLocalAssetsLink((_a = r.collection_metadata) === null || _a === void 0 ? void 0 : _a.imageUrl),
                            floorAskPrice: r.collection_floor_sell_value
                                ? (0, utils_1.formatEth)(r.collection_floor_sell_value)
                                : null,
                        },
                    },
                };
            });
            let continuation = null;
            if (bids.length >= query.limit) {
                continuation = offset + query.limit;
            }
            return {
                totalTokensWithBids,
                topBids: results,
                continuation: continuation ? (0, utils_1.buildContinuation)(continuation.toString()) : undefined,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-user-top-bids-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map