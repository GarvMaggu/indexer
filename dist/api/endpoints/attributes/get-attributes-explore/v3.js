"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttributesExploreV3Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const assets_1 = require("@/utils/assets");
const version = "v3";
exports.getAttributesExploreV3Options = {
    description: "Explore attributes",
    notes: "Get detailed aggregate about attributes in a collection, attribute floors",
    tags: ["api", "Attributes"],
    plugins: {
        "hapi-swagger": {
            order: 15,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
        query: joi_1.default.object({
            includeTopBid: joi_1.default.boolean()
                .default(false)
                .description("If true, top bid will be returned in the response."),
            attributeKey: joi_1.default.string().description("Filter to a particular attribute key. Example: `Composition`"),
            maxFloorAskPrices: joi_1.default.number()
                .integer()
                .min(1)
                .max(20)
                .default(1)
                .description("Max number of items returned in the response."),
            maxLastSells: joi_1.default.number()
                .integer()
                .min(0)
                .max(20)
                .default(0)
                .description("Max number of items returned in the response."),
            sortBy: joi_1.default.string()
                .valid("floorAskPrice", "topBidValue")
                .default("floorAskPrice")
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
                .max(5000)
                .default(20)
                .description("Amount of items returned in response."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            attributes: joi_1.default.array().items(joi_1.default.object({
                key: joi_1.default.string().required(),
                value: joi_1.default.string().required(),
                tokenCount: joi_1.default.number().required(),
                onSaleCount: joi_1.default.number().required(),
                sampleImages: joi_1.default.array().items(joi_1.default.string().allow(null, "")),
                floorAskPrices: joi_1.default.array().items(joi_1.default.number().unsafe()),
                lastBuys: joi_1.default.array().items(joi_1.default.object({
                    tokenId: joi_1.default.string().required(),
                    value: joi_1.default.number().unsafe().required(),
                    timestamp: joi_1.default.number().required(),
                })),
                lastSells: joi_1.default.array().items(joi_1.default.object({
                    tokenId: joi_1.default.string().required(),
                    value: joi_1.default.number().unsafe().required(),
                    timestamp: joi_1.default.number().required(),
                })),
                topBid: joi_1.default.object({
                    id: joi_1.default.string().allow(null),
                    value: joi_1.default.number().unsafe().allow(null),
                    maker: joi_1.default.string()
                        .lowercase()
                        .pattern(/^0x[a-fA-F0-9]{40}$/)
                        .allow(null),
                    validFrom: joi_1.default.number().unsafe().allow(null),
                    validUntil: joi_1.default.number().unsafe().allow(null),
                }).optional(),
            })),
        }).label(`getAttributesExplore${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-attributes-explore-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        const params = request.params;
        let attributeKeyFilter = "";
        let sortBy = "ORDER BY floor_sell_value DESC NULLS LAST";
        let selectQuery = "SELECT attributes.id, floor_sell_value, token_count, on_sale_count, key, value, sample_images, recent_floor_values_info.*";
        if (query.attributeKey) {
            attributeKeyFilter = `AND attributes.key = $/attributeKey/`;
        }
        // Sorting
        switch (query.sortBy) {
            case "topBuyValue": {
                sortBy = "ORDER BY top_buy_value DESC NULLS LAST";
                break;
            }
        }
        // If the client asks for multiple floor prices
        let tokensInfoQuery = `SELECT NULL AS "floor_sell_values"`;
        const tokenInfoSelectColumns = [];
        if (query.maxFloorAskPrices > 1) {
            tokenInfoSelectColumns.push(`
            (
                (array_agg(tokens.floor_sell_value ORDER BY tokens.floor_sell_value)
                 FILTER (WHERE tokens.floor_sell_value IS NOT NULL)
                )::text[]
            )[1:${query.maxFloorAskPrices}] AS "floor_sell_values"
      `);
        }
        if (query.maxLastSells) {
            tokenInfoSelectColumns.push(`
            ((array_agg(
              json_build_object(
                'tokenId', tokens.token_id,
                'value', tokens.last_sell_value::text,
                'timestamp', tokens.last_sell_timestamp
              ) ORDER BY tokens.last_sell_timestamp DESC
            ) FILTER (WHERE tokens.last_sell_value IS NOT NULL AND tokens.last_sell_value > 0) )::json[])[1:${query.maxLastSells}] AS "last_sells",
            ((array_agg(
              json_build_object(
                'tokenId', tokens.token_id,
                'value', tokens.last_buy_value::text,
                'timestamp', tokens.last_buy_timestamp
              ) ORDER BY tokens.last_buy_timestamp DESC
            ) FILTER (WHERE tokens.last_buy_value IS NOT NULL))::json[])[1:${query.maxLastSells}] AS "last_buys"
      `);
        }
        if (!lodash_1.default.isEmpty(tokenInfoSelectColumns)) {
            tokensInfoQuery = `
        SELECT ${lodash_1.default.join(tokenInfoSelectColumns, ",")}
        FROM token_attributes
        JOIN tokens ON token_attributes.contract = tokens.contract AND token_attributes.token_id = tokens.token_id
        WHERE token_attributes.attribute_id = attributes.id
        GROUP BY token_attributes.attribute_id
      `;
        }
        let topBidQuery = "";
        if (query.includeTopBid) {
            selectQuery += ", top_buy_info.*";
            topBidQuery = `LEFT JOIN LATERAL (
          SELECT  token_sets.top_buy_id,
                  token_sets.top_buy_value,
                  token_sets.top_buy_maker,
                  date_part('epoch', lower(orders.valid_between)) AS "top_buy_valid_from",
                  coalesce(nullif(date_part('epoch', upper(orders.valid_between)), 'Infinity'), 0) AS "top_buy_valid_until"
          FROM token_sets
          LEFT JOIN orders ON token_sets.top_buy_id = orders.id
          WHERE token_sets.attribute_id = attributes.id
          ORDER BY token_sets.top_buy_value DESC NULLS LAST
          LIMIT 1
      ) "top_buy_info" ON TRUE`;
        }
        try {
            const attributesQuery = `
            ${selectQuery}
            FROM attributes
            ${topBidQuery}
            JOIN LATERAL (
                ${tokensInfoQuery}
            ) "recent_floor_values_info" ON TRUE
            WHERE attributes.collection_id = $/collection/
            ${attributeKeyFilter}
            ${sortBy}
            OFFSET $/offset/
            LIMIT $/limit/`;
            const attributesData = await db_1.redb.manyOrNone(attributesQuery, { ...query, ...params });
            // If no attributes found return here
            if (lodash_1.default.isEmpty(attributesData)) {
                return { attributes: [] };
            }
            const result = lodash_1.default.map(attributesData, (r) => ({
                key: r.key,
                value: r.value,
                tokenCount: Number(r.token_count),
                onSaleCount: Number(r.on_sale_count),
                sampleImages: assets_1.Assets.getLocalAssetsLink(r.sample_images) || [],
                floorAskPrices: query.maxFloorAskPrices > 1
                    ? (r.floor_sell_values || []).map(utils_1.formatEth)
                    : [(0, utils_1.formatEth)(r.floor_sell_value || 0)],
                lastBuys: query.maxLastSells
                    ? (r.last_buys || []).map(({ tokenId, value, timestamp }) => ({
                        tokenId: `${tokenId}`,
                        value: (0, utils_1.formatEth)(value),
                        timestamp: Number(timestamp),
                    }))
                    : [],
                lastSells: query.maxLastSells
                    ? (r.last_sells || []).map(({ tokenId, value, timestamp }) => ({
                        tokenId: `${tokenId}`,
                        value: (0, utils_1.formatEth)(value),
                        timestamp: Number(timestamp),
                    }))
                    : [],
                topBid: query.includeTopBid
                    ? {
                        id: r.top_buy_id,
                        value: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                        maker: r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null,
                        validFrom: r.top_buy_valid_from,
                        validUntil: r.top_buy_value ? r.top_buy_valid_until : null,
                    }
                    : undefined,
            }));
            return { attributes: result };
        }
        catch (error) {
            logger_1.logger.error(`get-attributes-explore-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v3.js.map