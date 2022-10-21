"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesBulkV1Options = void 0;
const crypto_1 = __importDefault(require("crypto"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const version = "v1";
exports.getSalesBulkV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 5000,
    },
    description: "Bulk historical sales",
    notes: "Note: this API is optimized for bulk access, and offers minimal filters/metadata. If you need more flexibility, try the `NFT API > Sales` endpoint",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            contract: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
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
        }),
    },
    response: {
        schema: joi_1.default.object({
            sales: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string(),
                saleId: joi_1.default.string(),
                token: joi_1.default.object({
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                    tokenId: joi_1.default.string().pattern(utils_1.regex.number),
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
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getSalesBulk${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-sales-bulk-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        // Filters
        const conditions = [];
        if (query.contract) {
            query.contract = (0, utils_1.toBuffer)(query.contract);
            conditions.push(`fill_events_2.contract = $/contract/`);
        }
        if (query.token) {
            const [contract, tokenId] = query.token.split(":");
            query.contract = (0, utils_1.toBuffer)(contract);
            query.tokenId = tokenId;
            conditions.push(`fill_events_2.contract = $/contract/ AND fill_events_2.token_id = $/tokenId/`);
        }
        if (query.continuation) {
            const [timestamp, logIndex, batchIndex] = (0, utils_1.splitContinuation)(query.continuation, /^(\d+)_(\d+)_(\d+)$/);
            query.timestamp = timestamp;
            query.logIndex = logIndex;
            query.batchIndex = batchIndex;
            conditions.push(`
        (fill_events_2.timestamp, fill_events_2.log_index, fill_events_2.batch_index) < ($/timestamp/, $/logIndex/, $/batchIndex/)
      `);
        }
        // We default in the code so that these values don't appear in the docs
        if (!query.startTimestamp) {
            query.startTimestamp = 0;
        }
        if (!query.endTimestamp) {
            query.endTimestamp = 9999999999;
        }
        conditions.push(`
      (fill_events_2.timestamp >= $/startTimestamp/ AND
      fill_events_2.timestamp <= $/endTimestamp/)
    `);
        let conditionsRendered = "";
        if (conditions.length) {
            conditionsRendered = "WHERE " + conditions.join(" AND ");
        }
        try {
            const baseQuery = `
        SELECT
          fill_events_2_data.*
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
            fill_events_2.block,
            fill_events_2.log_index,
            fill_events_2.batch_index
          FROM fill_events_2
          ${conditionsRendered}            
          ORDER BY
            fill_events_2.timestamp DESC,
            fill_events_2.log_index DESC,
            fill_events_2.batch_index DESC
          LIMIT $/limit/
        ) AS fill_events_2_data
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
                };
            });
            return {
                sales: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-sales-bulk-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map