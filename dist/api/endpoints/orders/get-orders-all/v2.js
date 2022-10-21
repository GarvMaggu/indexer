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
exports.getOrdersAllV2Options = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const joi_2 = require("@/common/joi");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const sources_1 = require("@/models/sources");
const version = "v2";
exports.getOrdersAllV2Options = {
    description: "Bulk historical orders",
    notes: "This API is designed for efficiently ingesting large volumes of orders, for external processing",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            id: joi_1.default.alternatives(joi_1.default.string(), joi_1.default.array().items(joi_1.default.string())).description("Order id(s)."),
            source: joi_1.default.string().description("Filter to a source by domain. Example: `opensea.io`"),
            native: joi_1.default.boolean().description("If true, results will filter only Reservoir orders."),
            side: joi_1.default.string().valid("sell", "buy").default("sell").description("Sell or buy side."),
            includeMetadata: joi_1.default.boolean()
                .default(false)
                .description("If true, metadata will be included in the response."),
            includeRawData: joi_1.default.boolean()
                .default(false)
                .description("If true, raw data will be included in the response."),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(1000)
                .default(50)
                .description("Amount of items returned in response."),
        }).oxor("id", "source", "native"),
    },
    response: {
        schema: joi_1.default.object({
            orders: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string().required(),
                kind: joi_1.default.string().required(),
                side: joi_1.default.string().valid("buy", "sell").required(),
                tokenSetId: joi_1.default.string().required(),
                tokenSetSchemaHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32).required(),
                contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
                taker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
                price: joi_2.JoiPrice,
                validFrom: joi_1.default.number().required(),
                validUntil: joi_1.default.number().required(),
                source: joi_1.default.string().allow(null, ""),
                feeBps: joi_1.default.number().allow(null),
                feeBreakdown: joi_1.default.array()
                    .items(joi_1.default.object({
                    kind: joi_1.default.string(),
                    recipient: joi_1.default.string().allow("", null),
                    // Should be `Joi.number().allow(null)` but we set to `Joi.any()` to cover
                    // objects eith wrong schema that were inserted by mistake into the db
                    bps: joi_1.default.any(),
                }))
                    .allow(null),
                status: joi_1.default.string(),
                expiration: joi_1.default.number().required(),
                createdAt: joi_1.default.string().required(),
                updatedAt: joi_1.default.string().required(),
                metadata: joi_1.default.object().allow(null),
                rawData: joi_1.default.object().allow(null),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getOrdersAll${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-orders-all-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
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
              WHERE token_sets.id = orders.token_set_id AND token_sets.schema_hash = orders.token_set_schema_hash)

            ELSE NULL
          END
        ) AS metadata
      `;
            let baseQuery = `
        SELECT
          orders.id,
          orders.kind,
          orders.side,
          orders.token_set_id,
          orders.token_set_schema_hash,
          orders.contract,
          orders.maker,
          orders.taker,
          orders.price,
          orders.value,
          DATE_PART('epoch', LOWER(orders.valid_between)) AS valid_from,
          COALESCE(
            NULLIF(DATE_PART('epoch', UPPER(orders.valid_between)), 'Infinity'),
            0
          ) AS valid_until,
          orders.source_id_int,
          orders.fee_bps,
          orders.fee_breakdown,
          COALESCE(
            NULLIF(DATE_PART('epoch', orders.expiration), 'Infinity'),
            0
          ) AS expiration,
          extract(epoch from orders.created_at) AS created_at,
          (
            CASE
              WHEN orders.fillability_status = 'filled' THEN 'filled'
              WHEN orders.fillability_status = 'cancelled' THEN 'cancelled'
              WHEN orders.fillability_status = 'expired' THEN 'expired'
              WHEN orders.fillability_status = 'no-balance' THEN 'inactive'
              WHEN orders.approval_status = 'no-approval' THEN 'inactive'
              ELSE 'active'
            END
          ) AS status,
          ${query.includeRawData ? `orders.raw_data,` : ""}
          ${query.includeMetadata ? `${metadataBuildQuery},` : ""}
          orders.updated_at
        FROM orders
      `;
            // Filters
            const conditions = [];
            if (query.id) {
                if (Array.isArray(query.id)) {
                    conditions.push(`orders.id IN ($/id:csv/)`);
                }
                else {
                    conditions.push(`orders.id = $/id/`);
                }
            }
            else {
                conditions.push(`orders.side = $/side/`);
                conditions.push(`orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance'`);
                if (query.source) {
                    const sources = await sources_1.Sources.getInstance();
                    let source;
                    // Try to get the source by name
                    source = sources.getByName(query.source, false);
                    // If the source was not found try to get it by domain
                    if (!source) {
                        source = sources.getByDomain(query.source, false);
                    }
                    if (!source) {
                        return { orders: [] };
                    }
                    query.source = source.id;
                    conditions.push(`orders.source_id_int = $/source/`);
                }
                if (query.native) {
                    conditions.push(`orders.is_reservoir`);
                }
                if (query.continuation) {
                    const [createdAt, id] = (0, utils_1.splitContinuation)(query.continuation, /^\d+(.\d+)?_0x[a-f0-9]{64}$/);
                    query.createdAt = createdAt;
                    query.id = id;
                    conditions.push(`(orders.created_at, orders.id) < (to_timestamp($/createdAt/), $/id/)`);
                }
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += ` ORDER BY orders.created_at DESC, orders.id DESC`;
            // Pagination
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            let continuation = null;
            if (rawResult.length === query.limit) {
                continuation = (0, utils_1.buildContinuation)(rawResult[rawResult.length - 1].created_at + "_" + rawResult[rawResult.length - 1].id);
            }
            const sources = await sources_1.Sources.getInstance();
            const result = rawResult.map(async (r) => {
                var _a, _b, _c, _d, _e;
                return ({
                    id: r.id,
                    kind: r.kind,
                    side: r.side,
                    tokenSetId: r.token_set_id,
                    tokenSetSchemaHash: (0, utils_1.fromBuffer)(r.token_set_schema_hash),
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    maker: (0, utils_1.fromBuffer)(r.maker),
                    taker: (0, utils_1.fromBuffer)(r.taker),
                    price: await (0, joi_2.getJoiPriceObject)({
                        gross: {
                            amount: (_a = r.currency_price) !== null && _a !== void 0 ? _a : r.price,
                            nativeAmount: r.price,
                        },
                        net: {
                            amount: (0, utils_1.getNetAmount)((_b = r.currency_price) !== null && _b !== void 0 ? _b : r.price, r.fee_bps),
                            nativeAmount: (0, utils_1.getNetAmount)(r.price, r.fee_bps),
                        },
                    }, r.currency
                        ? (0, utils_1.fromBuffer)(r.currency)
                        : r.side === "sell"
                            ? Sdk.Common.Addresses.Eth[index_1.config.chainId]
                            : Sdk.Common.Addresses.Weth[index_1.config.chainId]),
                    validFrom: Number(r.valid_from),
                    validUntil: Number(r.valid_until),
                    source: (_c = sources.get(r.source_id_int)) === null || _c === void 0 ? void 0 : _c.name,
                    feeBps: Number(r.fee_bps),
                    feeBreakdown: r.fee_breakdown,
                    expiration: Number(r.expiration),
                    status: r.status,
                    createdAt: new Date(r.created_at * 1000).toISOString(),
                    updatedAt: new Date(r.updated_at).toISOString(),
                    rawData: (_d = r.raw_data) !== null && _d !== void 0 ? _d : undefined,
                    metadata: (_e = r.metadata) !== null && _e !== void 0 ? _e : undefined,
                });
            });
            return {
                orders: await Promise.all(result),
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-orders-all-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map