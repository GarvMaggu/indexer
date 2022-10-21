"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesV4Options = void 0;
const crypto_1 = __importDefault(require("crypto"));
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const joi_2 = require("@/common/joi");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const assets_1 = require("@/utils/assets");
const version = "v4";
exports.getSalesV4Options = {
    description: "Sales",
    notes: "Get recent sales for a contract or token.",
    tags: ["api", "Sales"],
    plugins: {
        "hapi-swagger": {
            order: 8,
        },
    },
    validate: {
        query: joi_1.default.object({
            contract: joi_1.default.alternatives()
                .try(joi_1.default.array().items(joi_1.default.string().lowercase().pattern(utils_1.regex.address)).max(20), joi_1.default.string().lowercase().pattern(utils_1.regex.address))
                .description("Array of contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            includeTokenMetadata: joi_1.default.boolean().description("If enabled, also include token metadata in the response."),
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            attributes: joi_1.default.object()
                .unknown()
                .description("Filter to a particular attribute. Example: `attributes[Type]=Original`"),
            txHash: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.bytes32)
                .description("Filter to a particular transaction. Example: `0x04654cc4c81882ed4d20b958e0eeb107915d75730110cce65333221439de6afc`"),
            startTimestamp: joi_1.default.number().description("Get events after a particular unix timestamp (inclusive)"),
            endTimestamp: joi_1.default.number().description("Get events before a particular unix timestamp (inclusive)"),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(1000)
                .default(100)
                .description("Amount of items returned in response."),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
        })
            .oxor("contract", "token", "collection", "txHash")
            .with("attributes", "collection"),
    },
    response: {
        schema: joi_1.default.object({
            sales: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string(),
                saleId: joi_1.default.string(),
                token: joi_1.default.object({
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                    tokenId: joi_1.default.string().pattern(utils_1.regex.number),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    collection: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        name: joi_1.default.string().allow(null, ""),
                    }),
                }),
                orderSource: joi_1.default.string().allow(null, ""),
                orderSide: joi_1.default.string().valid("ask", "bid"),
                orderKind: joi_1.default.string(),
                orderId: joi_1.default.string().allow(null),
                from: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                to: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                amount: joi_1.default.string(),
                fillSource: joi_1.default.string().allow(null),
                block: joi_1.default.number(),
                txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32),
                logIndex: joi_1.default.number(),
                batchIndex: joi_1.default.number(),
                timestamp: joi_1.default.number(),
                price: joi_2.JoiPrice,
                washTradingScore: joi_1.default.number(),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getSales${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-sales-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        let paginationFilter = "";
        let tokenFilter = "";
        let tokenJoins = "";
        let collectionFilter = "";
        // Filters
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
            tokenFilter = `fill_events_2.contract IN ($/contractsFilter:raw/)`;
        }
        else if (query.token) {
            const [contract, tokenId] = query.token.split(":");
            query.contract = (0, utils_1.toBuffer)(contract);
            query.tokenId = tokenId;
            tokenFilter = `fill_events_2.contract = $/contract/ AND fill_events_2.token_id = $/tokenId/`;
        }
        else if (query.collection) {
            if (query.attributes) {
                const attributes = [];
                Object.entries(query.attributes).forEach(([key, values]) => {
                    (Array.isArray(values) ? values : [values]).forEach((value) => attributes.push({ key, value }));
                });
                for (let i = 0; i < attributes.length; i++) {
                    query[`key${i}`] = attributes[i].key;
                    query[`value${i}`] = attributes[i].value;
                    tokenJoins += `
            JOIN token_attributes ta${i}
              ON fill_events_2.contract = ta${i}.contract
              AND fill_events_2.token_id = ta${i}.token_id
              AND ta${i}.key = $/key${i}/
              AND ta${i}.value = $/value${i}/
          `;
                }
            }
            if (query.collection.match(/^0x[a-f0-9]{40}:\d+:\d+$/g)) {
                const [contract, startTokenId, endTokenId] = query.collection.split(":");
                query.contract = (0, utils_1.toBuffer)(contract);
                query.startTokenId = startTokenId;
                query.endTokenId = endTokenId;
                collectionFilter = `
          fill_events_2.contract = $/contract/
          AND fill_events_2.token_id >= $/startTokenId/
          AND fill_events_2.token_id <= $/endTokenId/
        `;
            }
            else {
                query.contract = (0, utils_1.toBuffer)(query.collection);
                collectionFilter = `fill_events_2.contract = $/contract/`;
            }
        }
        else if (query.txHash) {
            query.txHash = (0, utils_1.toBuffer)(query.txHash);
            collectionFilter = `fill_events_2.tx_hash = $/txHash/`;
        }
        else {
            collectionFilter = "TRUE";
        }
        if (query.continuation) {
            const [timestamp, logIndex, batchIndex] = (0, utils_1.splitContinuation)(query.continuation, /^(\d+)_(\d+)_(\d+)$/);
            query.timestamp = timestamp;
            query.logIndex = logIndex;
            query.batchIndex = batchIndex;
            paginationFilter = `
        AND (fill_events_2.timestamp, fill_events_2.log_index, fill_events_2.batch_index) < ($/timestamp/, $/logIndex/, $/batchIndex/)
      `;
        }
        // We default in the code so that these values don't appear in the docs
        if (!query.startTimestamp) {
            query.startTimestamp = 0;
        }
        if (!query.endTimestamp) {
            query.endTimestamp = 9999999999;
        }
        const timestampFilter = `
      AND (fill_events_2.timestamp >= $/startTimestamp/ AND
      fill_events_2.timestamp <= $/endTimestamp/)
    `;
        try {
            const baseQuery = `
        SELECT
          fill_events_2_data.*
          ${query.includeTokenMetadata
                ? `
                  ,
                  tokens_data.name,
                  tokens_data.image,
                  tokens_data.collection_id,
                  tokens_data.collection_name
                `
                : ""}
        FROM (
          SELECT
            fill_events_2.contract,
            fill_events_2.token_id,
            fill_events_2.order_id,
            fill_events_2.order_side,
            fill_events_2.order_kind,
            fill_events_2.order_source_id_int,
            fill_events_2.maker,
            fill_events_2.taker,
            fill_events_2.amount,
            fill_events_2.fill_source_id,
            fill_events_2.block,
            fill_events_2.tx_hash,
            fill_events_2.timestamp,
            fill_events_2.price,
            fill_events_2.currency,
            TRUNC(fill_events_2.currency_price, 0) AS currency_price,
            currencies.decimals,
            fill_events_2.usd_price,
            fill_events_2.block,
            fill_events_2.log_index,
            fill_events_2.batch_index,
            fill_events_2.wash_trading_score
          FROM fill_events_2
          LEFT JOIN currencies
            ON fill_events_2.currency = currencies.contract
          ${tokenJoins}
          WHERE
            ${collectionFilter}
            ${tokenFilter}
            ${paginationFilter}
            ${timestampFilter}
          ORDER BY
            fill_events_2.timestamp DESC,
            fill_events_2.log_index DESC,
            fill_events_2.batch_index DESC
          LIMIT $/limit/
        ) AS fill_events_2_data
        ${query.includeTokenMetadata
                ? `
                JOIN LATERAL (
                  SELECT
                    tokens.name,
                    tokens.image,
                    tokens.collection_id,
                    collections.name AS collection_name
                  FROM tokens
                  LEFT JOIN collections 
                    ON tokens.collection_id = collections.id
                  WHERE fill_events_2_data.token_id = tokens.token_id
                    AND fill_events_2_data.contract = tokens.contract
                ) tokens_data ON TRUE
              `
                : ""}
      `;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            let continuation = null;
            if (rawResult.length === query.limit) {
                continuation = (0, utils_1.buildContinuation)(rawResult[rawResult.length - 1].timestamp +
                    "_" +
                    rawResult[rawResult.length - 1].log_index +
                    "_" +
                    rawResult[rawResult.length - 1].batch_index);
            }
            const sources = await sources_1.Sources.getInstance();
            const result = rawResult.map(async (r) => {
                var _a, _b, _c, _d, _e, _f, _g, _j;
                const orderSource = r.order_source_id_int !== null ? sources.get(Number(r.order_source_id_int)) : undefined;
                const fillSource = r.fill_source_id !== null ? sources.get(Number(r.fill_source_id)) : undefined;
                return {
                    id: crypto_1.default
                        .createHash("sha256")
                        .update(`${(0, utils_1.fromBuffer)(r.tx_hash)}${r.log_index}${r.batch_index}`)
                        .digest("hex"),
                    saleId: crypto_1.default
                        .createHash("sha256")
                        .update(`${(0, utils_1.fromBuffer)(r.tx_hash)}${r.maker}${r.taker}${r.contract}${r.token_id}${r.price}`)
                        .digest("hex"),
                    token: {
                        contract: (0, utils_1.fromBuffer)(r.contract),
                        tokenId: r.token_id,
                        name: (_a = r.name) !== null && _a !== void 0 ? _a : null,
                        image: (_b = assets_1.Assets.getLocalAssetsLink(r.image)) !== null && _b !== void 0 ? _b : null,
                        collection: {
                            id: (_c = r.collection_id) !== null && _c !== void 0 ? _c : null,
                            name: (_d = r.collection_name) !== null && _d !== void 0 ? _d : null,
                        },
                    },
                    orderId: r.order_id,
                    orderSource: (_e = orderSource === null || orderSource === void 0 ? void 0 : orderSource.domain) !== null && _e !== void 0 ? _e : null,
                    orderSide: r.order_side === "sell" ? "ask" : "bid",
                    orderKind: r.order_kind,
                    from: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.maker) : (0, utils_1.fromBuffer)(r.taker),
                    to: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.taker) : (0, utils_1.fromBuffer)(r.maker),
                    amount: String(r.amount),
                    fillSource: (_g = (_f = fillSource === null || fillSource === void 0 ? void 0 : fillSource.domain) !== null && _f !== void 0 ? _f : orderSource === null || orderSource === void 0 ? void 0 : orderSource.domain) !== null && _g !== void 0 ? _g : null,
                    block: r.block,
                    txHash: (0, utils_1.fromBuffer)(r.tx_hash),
                    logIndex: r.log_index,
                    batchIndex: r.batch_index,
                    timestamp: r.timestamp,
                    price: await (0, joi_2.getJoiPriceObject)({
                        gross: {
                            amount: (_j = r.currency_price) !== null && _j !== void 0 ? _j : r.price,
                            nativeAmount: r.price,
                            usdAmount: r.usd_price,
                        },
                    }, (0, utils_1.fromBuffer)(r.currency)),
                    washTradingScore: r.wash_trading_score,
                };
            });
            return {
                sales: await Promise.all(result),
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-sales-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v4.js.map