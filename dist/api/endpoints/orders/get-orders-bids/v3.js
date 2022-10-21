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
exports.getOrdersBidsV3Options = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const joi_2 = require("@/common/joi");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const sources_1 = require("@/models/sources");
const version = "v3";
exports.getOrdersBidsV3Options = {
    description: "Bids (offers)",
    notes: "Get a list of bids (offers), filtered by token, collection or maker. This API is designed for efficiently ingesting large volumes of orders, for external processing",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 5,
        },
    },
    validate: {
        query: joi_1.default.object({
            ids: joi_1.default.alternatives(joi_1.default.string(), joi_1.default.array().items(joi_1.default.string())).description("Order id(s) to search for (only fillable and approved orders will be returned)"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            tokenSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular set. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            maker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular user. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            contracts: joi_1.default.alternatives().try(joi_1.default.array()
                .max(50)
                .items(joi_1.default.string().lowercase().pattern(utils_1.regex.address))
                .description("Filter to an array of contracts. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"), joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to an array of contracts. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`")),
            status: joi_1.default.string()
                .when("maker", {
                is: joi_1.default.exist(),
                then: joi_1.default.valid("active", "inactive"),
                otherwise: joi_1.default.valid("active"),
            })
                .description("active = currently valid, inactive = temporarily invalid, expired = permanently invalid\n\nAvailable when filtering by maker, otherwise only valid orders will be returned"),
            source: joi_1.default.string()
                .pattern(utils_1.regex.domain)
                .description("Filter to a source by domain. Example: `opensea.io`"),
            native: joi_1.default.boolean().description("If true, results will filter only Reservoir orders."),
            includeMetadata: joi_1.default.boolean()
                .default(false)
                .description("If true, metadata is included in the response."),
            includeRawData: joi_1.default.boolean()
                .default(false)
                .description("If true, raw data is included in the response."),
            sortBy: joi_1.default.string()
                .when("token", {
                is: joi_1.default.exist(),
                then: joi_1.default.valid("price", "createdAt"),
                otherwise: joi_1.default.valid("createdAt"),
            })
                .valid("createdAt", "price")
                .default("createdAt")
                .description("Order the items are returned in the response, Sorting by price allowed only when filtering by token"),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(1000)
                .default(50)
                .description("Amount of items returned in response."),
        }).oxor("token", "tokenSetId", "contracts", "ids", "source", "native"),
    },
    response: {
        schema: joi_1.default.object({
            orders: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string().required(),
                kind: joi_1.default.string().required(),
                side: joi_1.default.string().valid("buy", "sell").required(),
                status: joi_1.default.string(),
                tokenSetId: joi_1.default.string().required(),
                tokenSetSchemaHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32).required(),
                contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
                taker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
                price: joi_2.JoiPrice,
                validFrom: joi_1.default.number().required(),
                validUntil: joi_1.default.number().required(),
                quantityFilled: joi_1.default.number().unsafe(),
                quantityRemaining: joi_1.default.number().unsafe(),
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
                }))
                    .allow(null)
                    .optional(),
                source: joi_1.default.object().allow(null),
                feeBps: joi_1.default.number().allow(null),
                feeBreakdown: joi_1.default.array()
                    .items(joi_1.default.object({
                    kind: joi_1.default.string(),
                    recipient: joi_1.default.string().allow("", null),
                    bps: joi_1.default.number(),
                }))
                    .allow(null),
                expiration: joi_1.default.number().required(),
                isReservoir: joi_1.default.boolean().allow(null),
                createdAt: joi_1.default.string().required(),
                updatedAt: joi_1.default.string().required(),
                rawData: joi_1.default.object().optional(),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getOrdersBids${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-orders-bids-${version}-handler`, `Wrong response schema: ${error}`);
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
              WHERE token_sets.id = orders.token_set_id)  
            ELSE NULL
          END
        ) AS metadata
      `;
            let baseQuery = `
        SELECT
          orders.id,
          orders.kind,
          orders.side,
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
          orders.token_set_id,
          orders.token_set_schema_hash,
          orders.contract,
          orders.maker,
          orders.taker,
          orders.price,
          orders.value,
          orders.currency,
          orders.currency_price,
          orders.currency_value,
          DATE_PART('epoch', LOWER(orders.valid_between)) AS valid_from,
          COALESCE(
            NULLIF(DATE_PART('epoch', UPPER(orders.valid_between)), 'Infinity'),
            0
          ) AS valid_until,
          orders.source_id_int,
          orders.quantity_filled,
          orders.quantity_remaining,
          orders.fee_bps,
          orders.fee_breakdown,
          COALESCE(
            NULLIF(DATE_PART('epoch', orders.expiration), 'Infinity'),
            0
          ) AS expiration,
          orders.is_reservoir,
          extract(epoch from orders.created_at) AS created_at,
          orders.updated_at
          ${query.includeRawData ? ", orders.raw_data" : ""}
          ${query.includeMetadata ? `, ${metadataBuildQuery}` : ""}
        FROM orders
      `;
            // Filters
            const conditions = [
                "EXISTS (SELECT FROM token_sets WHERE id = orders.token_set_id)",
                "orders.side = 'buy'",
            ];
            let orderStatusFilter = `orders.fillability_status = 'fillable' AND orders.approval_status = 'approved'`;
            if (query.ids) {
                if (Array.isArray(query.ids)) {
                    conditions.push(`orders.id IN ($/ids:csv/)`);
                }
                else {
                    conditions.push(`orders.id = $/ids/`);
                }
            }
            if (query.token || query.tokenSetId) {
                if (query.token) {
                    query.tokenSetId = `token:${query.token}`;
                }
                conditions.push(`orders.token_set_id = $/tokenSetId/`);
            }
            if (query.contracts) {
                if (!lodash_1.default.isArray(query.contracts)) {
                    query.contracts = [query.contracts];
                }
                for (const contract of query.contracts) {
                    const contractsFilter = `'${lodash_1.default.replace(contract, "0x", "\\x")}'`;
                    if (lodash_1.default.isUndefined(query.contractsFilter)) {
                        query.contractsFilter = [];
                    }
                    query.contractsFilter.push(contractsFilter);
                }
                query.contractsFilter = lodash_1.default.join(query.contractsFilter, ",");
                conditions.push(`orders.contract IN ($/contractsFilter:raw/)`);
            }
            if (query.maker) {
                switch (query.status) {
                    case "inactive": {
                        // Potentially-valid orders
                        orderStatusFilter = `orders.fillability_status = 'no-balance' OR (orders.fillability_status = 'fillable' AND orders.approval_status != 'approved')`;
                        break;
                    }
                }
                query.maker = (0, utils_1.toBuffer)(query.maker);
                conditions.push(`orders.maker = $/maker/`);
            }
            if (query.source) {
                const sources = await sources_1.Sources.getInstance();
                const source = sources.getByDomain(query.source);
                if (!source) {
                    return { orders: [] };
                }
                query.source = source.id;
                conditions.push(`orders.source_id_int = $/source/`);
            }
            if (query.native) {
                conditions.push(`orders.is_reservoir`);
            }
            conditions.push(orderStatusFilter);
            if (query.continuation) {
                const [priceOrCreatedAt, id] = (0, utils_1.splitContinuation)(query.continuation, /^\d+(.\d+)?_0x[a-f0-9]{64}$/);
                query.priceOrCreatedAt = priceOrCreatedAt;
                query.id = id;
                if (query.sortBy === "price") {
                    conditions.push(`(orders.price, orders.id) < ($/priceOrCreatedAt/, $/id/)`);
                }
                else {
                    conditions.push(`(orders.created_at, orders.id) < (to_timestamp($/priceOrCreatedAt/), $/id/)`);
                }
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            if (query.sortBy === "price") {
                baseQuery += ` ORDER BY orders.price DESC, orders.id DESC`;
            }
            else {
                baseQuery += ` ORDER BY orders.created_at DESC, orders.id DESC`;
            }
            // Pagination
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            let continuation = null;
            if (rawResult.length === query.limit) {
                if (query.sortBy === "price") {
                    continuation = (0, utils_1.buildContinuation)(rawResult[rawResult.length - 1].price + "_" + rawResult[rawResult.length - 1].id);
                }
                else {
                    continuation = (0, utils_1.buildContinuation)(rawResult[rawResult.length - 1].created_at + "_" + rawResult[rawResult.length - 1].id);
                }
            }
            const sources = await sources_1.Sources.getInstance();
            const result = rawResult.map(async (r) => {
                var _a, _b, _c;
                let source;
                if ((_a = r.token_set_id) === null || _a === void 0 ? void 0 : _a.startsWith("token")) {
                    const [, contract, tokenId] = r.token_set_id.split(":");
                    source = sources.get(Number(r.source_id_int), contract, tokenId);
                }
                else {
                    source = sources.get(Number(r.source_id_int));
                }
                return {
                    id: r.id,
                    kind: r.kind,
                    side: r.side,
                    status: r.status,
                    tokenSetId: r.token_set_id,
                    tokenSetSchemaHash: (0, utils_1.fromBuffer)(r.token_set_schema_hash),
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    maker: (0, utils_1.fromBuffer)(r.maker),
                    taker: (0, utils_1.fromBuffer)(r.taker),
                    price: await (0, joi_2.getJoiPriceObject)({
                        gross: {
                            amount: (_b = r.currency_price) !== null && _b !== void 0 ? _b : r.price,
                            nativeAmount: r.price,
                        },
                        net: {
                            amount: (_c = r.currency_value) !== null && _c !== void 0 ? _c : r.value,
                            nativeAmount: r.value,
                        },
                    }, r.currency
                        ? (0, utils_1.fromBuffer)(r.currency)
                        : r.side === "sell"
                            ? Sdk.Common.Addresses.Eth[index_1.config.chainId]
                            : Sdk.Common.Addresses.Weth[index_1.config.chainId]),
                    validFrom: Number(r.valid_from),
                    validUntil: Number(r.valid_until),
                    quantityFilled: Number(r.quantity_filled),
                    quantityRemaining: Number(r.quantity_remaining),
                    metadata: query.includeMetadata ? r.metadata : undefined,
                    source: {
                        id: source === null || source === void 0 ? void 0 : source.address,
                        name: (source === null || source === void 0 ? void 0 : source.metadata.title) || (source === null || source === void 0 ? void 0 : source.name),
                        icon: source === null || source === void 0 ? void 0 : source.metadata.icon,
                        url: source === null || source === void 0 ? void 0 : source.metadata.url,
                    },
                    feeBps: Number(r.fee_bps),
                    feeBreakdown: r.fee_breakdown,
                    expiration: Number(r.expiration),
                    isReservoir: r.is_reservoir,
                    createdAt: new Date(r.created_at * 1000).toISOString(),
                    updatedAt: new Date(r.updated_at).toISOString(),
                    rawData: query.includeRawData ? r.raw_data : undefined,
                };
            });
            return {
                orders: await Promise.all(result),
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-orders-bids-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v3.js.map