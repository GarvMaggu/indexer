"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrdersBidsV2Options = void 0;
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const version = "v2";
exports.getOrdersBidsV2Options = {
    description: "Bids (offers)",
    notes: "Get a list of bids (offers), filtered by token, collection or maker. This API is designed for efficiently ingesting large volumes of orders, for external processing",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
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
            sortBy: joi_1.default.string()
                .when("token", {
                is: joi_1.default.exist(),
                then: joi_1.default.valid("price", "createdAt"),
                otherwise: joi_1.default.valid("createdAt"),
            })
                .default("createdAt")
                .description("Order the items are returned in the response."),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(1000)
                .default(50)
                .description("Amount of items returned in response."),
        })
            .or("token", "tokenSetId", "maker", "contracts")
            .oxor("token", "tokenSetId"),
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
                price: joi_1.default.number().unsafe().required(),
                value: joi_1.default.number().unsafe().required(),
                validFrom: joi_1.default.number().required(),
                validUntil: joi_1.default.number().required(),
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
                createdAt: joi_1.default.string().required(),
                updatedAt: joi_1.default.string().required(),
                rawData: joi_1.default.object(),
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
          orders.updated_at,
          orders.raw_data,
          ${metadataBuildQuery}
        FROM orders
      `;
            // Filters
            const conditions = [`orders.side = 'buy'`];
            let orderStatusFilter = `orders.fillability_status = 'fillable' AND orders.approval_status = 'approved'`;
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
            // HACK: Maximum limit is 100
            query.limit = Math.min(query.limit, 100);
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
                var _a;
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
                    price: (0, utils_1.formatEth)(r.price),
                    // For consistency, we set the value of "sell" orders as price - fee
                    value: r.side === "buy"
                        ? (0, utils_1.formatEth)(r.value)
                        : (0, utils_1.formatEth)(r.value) - ((0, utils_1.formatEth)(r.value) * Number(r.fee_bps)) / 10000,
                    validFrom: Number(r.valid_from),
                    validUntil: Number(r.valid_until),
                    metadata: r.metadata,
                    source: {
                        id: source === null || source === void 0 ? void 0 : source.address,
                        name: (source === null || source === void 0 ? void 0 : source.metadata.title) || (source === null || source === void 0 ? void 0 : source.name),
                        icon: source === null || source === void 0 ? void 0 : source.metadata.icon,
                        url: source === null || source === void 0 ? void 0 : source.metadata.url,
                    },
                    feeBps: Number(r.fee_bps),
                    feeBreakdown: r.fee_breakdown,
                    expiration: Number(r.expiration),
                    createdAt: new Date(r.created_at * 1000).toISOString(),
                    updatedAt: new Date(r.updated_at).toISOString(),
                    rawData: r.raw_data,
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
//# sourceMappingURL=v2.js.map