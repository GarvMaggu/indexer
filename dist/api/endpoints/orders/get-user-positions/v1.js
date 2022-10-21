"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserPositionsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getUserPositionsV1Options = {
    description: "Get a summary of a users bids and asks",
    notes: "Get aggregate user liquidity, grouped by collection. Useful for showing a summary of liquidity being provided (orders made).",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        params: joi_1.default.object({
            user: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .required()
                .description("Wallet to see results for e.g. `0xf296178d553c8ec21a2fbd2c5dda8ca9ac905a00`"),
        }),
        query: joi_1.default.object({
            side: joi_1.default.string().lowercase().valid("buy", "sell").required(),
            status: joi_1.default.string().lowercase().valid("valid", "invalid").required(),
            offset: joi_1.default.number().integer().min(0).default(0),
            limit: joi_1.default.number().integer().min(1).max(100).default(20),
        }),
    },
    response: {
        schema: joi_1.default.object({
            positions: joi_1.default.array().items(joi_1.default.object({
                set: {
                    id: joi_1.default.string(),
                    metadata: joi_1.default.alternatives(joi_1.default.object({
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
                    sampleImages: joi_1.default.array().items(joi_1.default.string().allow(null, "")),
                    image: joi_1.default.string().allow(null, ""),
                    floorAskPrice: joi_1.default.number().unsafe().allow(null),
                    topBidValue: joi_1.default.number().unsafe().allow(null),
                },
                primaryOrder: {
                    id: joi_1.default.string().allow(null),
                    value: joi_1.default.number().unsafe().allow(null),
                    expiration: joi_1.default.number().unsafe().allow(null),
                },
                totalValid: joi_1.default.number().allow(null),
            })),
        }).label(`getUserPositions${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-positions-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const query = request.query;
        try {
            const metadataBuildQuery = `
        (
          CASE
            WHEN orders.token_set_id LIKE 'token:%' THEN
              (SELECT
                json_build_object(
                  'kind', 'token',
                  'data', json_build_object(
                    'collectionName', collections.name,
                    'tokenName', tokens.name,
                    'image', tokens.image
                  )
                )
              FROM tokens
              JOIN collections
                ON tokens.collection_id = collections.id
              WHERE tokens.contract = decode(substring(split_part(orders.token_set_id, ':', 2) from 3), 'hex')
                AND tokens.token_id = (split_part(orders.token_set_id, ':', 3)::NUMERIC(78, 0)))

            WHEN orders.token_set_id LIKE 'contract:%' THEN
              (SELECT
                json_build_object(
                  'kind', 'collection',
                  'data', json_build_object(
                    'collectionName', collections.name,
                    'image', (collections.metadata ->> 'imageUrl')::TEXT
                  )
                )
              FROM collections
              WHERE collections.id = substring(orders.token_set_id from 10))

            WHEN orders.token_set_id LIKE 'range:%' THEN
              (SELECT
                json_build_object(
                  'kind', 'collection',
                  'data', json_build_object(
                    'collectionName', collections.name,
                    'image', (collections.metadata ->> 'imageUrl')::TEXT
                  )
                )
              FROM collections
              WHERE collections.id = substring(orders.token_set_id from 7))

            WHEN orders.token_set_id LIKE 'list:%' THEN
              (SELECT
                json_build_object(
                  'kind', 'attribute',
                  'data', json_build_object(
                    'collectionName', collections.name,
                    'attributes', ARRAY[json_build_object('key', attribute_keys.key, 'value', attributes.value)],
                    'image', (collections.metadata ->> 'imageUrl')::TEXT
                  )
                )
              FROM token_sets
              JOIN attributes
                ON token_sets.attribute_id = attributes.id
              JOIN attribute_keys
                ON attributes.attribute_key_id = attribute_keys.id
              JOIN collections
                ON attribute_keys.collection_id = collections.id
              WHERE token_sets.id = orders.token_set_id)

            ELSE NULL
          END
        ) AS metadata
      `;
            let baseQuery;
            params.user = (0, utils_1.toBuffer)(params.user);
            if (query.status === "valid") {
                baseQuery = `
          SELECT DISTINCT ON (orders.token_set_id)
            orders.id,
            orders.token_set_id,
            orders.value,
            coalesce(nullif(date_part('epoch', orders.expiration), 'Infinity'), 0) AS expiration,
            (COUNT(*) OVER (PARTITION BY orders.token_set_id)) AS total_valid,
            ${metadataBuildQuery}
          FROM orders
          WHERE (orders.fillability_status = 'fillable' AND orders.approval_status = 'approved')
            AND orders.side = $/side/
            AND orders.maker = $/user/
          ORDER BY orders.token_set_id, orders.value
        `;
            }
            else if (query.status === "invalid") {
                baseQuery = `
          SELECT DISTINCT ON (orders.token_set_id)
            orders.id,
            orders.token_set_id,
            orders.value,
            coalesce(nullif(date_part('epoch', orders.expiration), 'Infinity'), 0) AS expiration,
            0 AS total_valid,
            ${metadataBuildQuery}
          FROM orders
          WHERE (orders.fillability_status != 'fillable' OR orders.approval_status != 'approved')
            AND orders.side = $/side/
            AND orders.maker = $/user/
          ORDER BY orders.token_set_id, orders.expiration DESC
        `;
            }
            baseQuery = `
        WITH "x" AS (${baseQuery})
        SELECT
          "x".*,
          array(
            SELECT
              "t"."image"
            FROM "tokens" "t"
            JOIN "token_sets_tokens" "tst"
              ON "t"."contract" = "tst"."contract"
              AND "t"."token_id" = "tst"."token_id"
            WHERE "tst"."token_set_id" = "x"."token_set_id"
            LIMIT 4
          ) AS "sample_images",
          (
            SELECT
              MIN("o"."value") AS "floor_sell_value"
            FROM "orders" "o"
            WHERE "o"."token_set_id" = "x"."token_set_id"
              AND "o"."side" = 'sell'
              AND ("o"."fillability_status" = 'fillable' AND "o"."approval_status" = 'approved')
          ),
          (
            SELECT
              MIN("o"."value") AS "top_buy_value"
            FROM "orders" "o"
            WHERE "o"."token_set_id" = "x"."token_set_id"
              AND "o"."side" = 'buy'
              AND ("o"."fillability_status" = 'fillable' AND "o"."approval_status" = 'approved')
          )
        FROM "x"
      `;
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            const result = await db_1.redb.manyOrNone(baseQuery, { ...query, ...params }).then((result) => result.map((r) => ({
                set: {
                    id: r.token_set_id,
                    metadata: r.metadata,
                    sampleImages: r.sample_images || [],
                    floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                    topBidValue: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                },
                primaryOrder: {
                    value: r.value ? (0, utils_1.formatEth)(r.value) : null,
                    expiration: r.expiration,
                    id: r.id,
                },
                totalValid: Number(r.total_valid),
            })));
            return { positions: result };
        }
        catch (error) {
            logger_1.logger.error(`get-users-positions-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map