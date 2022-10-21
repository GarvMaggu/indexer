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
exports.getSalesV3Options = void 0;
const constants_1 = require("@ethersproject/constants");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const crypto_1 = __importDefault(require("crypto"));
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const sources_1 = require("@/models/sources");
const version = "v3";
exports.getSalesV3Options = {
    description: "Historical sales",
    notes: "Get recent sales for a contract or token. Note: this API is returns rich metadata, and has advanced filters, so is only designed for small amounts of recent sales. If you want access to sales in bulk, use the `Aggregator > Bulk Sales` API.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
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
                .max(100)
                .default(20)
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
                orderSourceDomain: joi_1.default.string().allow(null, ""),
                orderSide: joi_1.default.string().valid("ask", "bid"),
                orderKind: joi_1.default.string(),
                from: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                to: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                amount: joi_1.default.string(),
                fillSource: joi_1.default.string().allow(null),
                txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32),
                logIndex: joi_1.default.number(),
                batchIndex: joi_1.default.number(),
                timestamp: joi_1.default.number(),
                price: joi_1.default.number().unsafe().allow(null),
                currency: joi_1.default.string().pattern(utils_1.regex.address),
                currencyPrice: joi_1.default.number().unsafe().allow(null),
                usdPrice: joi_1.default.number().unsafe().allow(null),
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
          fill_events_2_data.*,
          tokens_data.name,
          tokens_data.image,
          tokens_data.collection_id,
          tokens_data.collection_name
        FROM (
          SELECT
            fill_events_2.contract,
            fill_events_2.token_id,
            fill_events_2.order_side,
            fill_events_2.order_kind,
            fill_events_2.order_source_id_int,
            fill_events_2.maker,
            fill_events_2.taker,
            fill_events_2.amount,
            fill_events_2.fill_source_id,
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
            const result = rawResult.map((r) => {
                var _a, _b, _c, _d;
                const orderSource = sources.get(Number(r.order_source_id_int));
                const fillSource = sources.get(Number(r.fill_source_id));
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
                        name: r.name,
                        image: r.image,
                        collection: {
                            id: r.collection_id,
                            name: r.collection_name,
                        },
                    },
                    orderSource: (_a = ((orderSource === null || orderSource === void 0 ? void 0 : orderSource.metadata.title) || (orderSource === null || orderSource === void 0 ? void 0 : orderSource.name))) !== null && _a !== void 0 ? _a : null,
                    orderSourceDomain: (_b = orderSource === null || orderSource === void 0 ? void 0 : orderSource.domain) !== null && _b !== void 0 ? _b : null,
                    orderSide: r.order_side === "sell" ? "ask" : "bid",
                    orderKind: r.order_kind,
                    from: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.maker) : (0, utils_1.fromBuffer)(r.taker),
                    to: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.taker) : (0, utils_1.fromBuffer)(r.maker),
                    amount: String(r.amount),
                    fillSource: (_d = (_c = fillSource === null || fillSource === void 0 ? void 0 : fillSource.domain) !== null && _c !== void 0 ? _c : orderSource === null || orderSource === void 0 ? void 0 : orderSource.domain) !== null && _d !== void 0 ? _d : null,
                    txHash: (0, utils_1.fromBuffer)(r.tx_hash),
                    logIndex: r.log_index,
                    batchIndex: r.batch_index,
                    timestamp: r.timestamp,
                    price: r.price ? (0, utils_1.formatEth)(r.price) : null,
                    currency: (0, utils_1.fromBuffer)(r.currency) === constants_1.AddressZero
                        ? r.order_side === "sell"
                            ? Sdk.Common.Addresses.Eth[index_1.config.chainId]
                            : Sdk.Common.Addresses.Weth[index_1.config.chainId]
                        : (0, utils_1.fromBuffer)(r.currency),
                    currencyPrice: r.currency_price
                        ? (0, utils_1.formatPrice)(r.currency_price, r.decimals)
                        : r.price
                            ? (0, utils_1.formatEth)(r.price)
                            : null,
                    usdPrice: r.usd_price ? (0, utils_1.formatUsd)(r.usd_price) : null,
                    washTradingScore: r.wash_trading_score,
                };
            });
            return {
                sales: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-sales-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v3.js.map