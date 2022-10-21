"use strict";
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
exports.SalesDataSource = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
const sources_1 = require("@/models/sources");
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("@ethersproject/constants");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const index_2 = require("@/config/index");
const currencies_1 = require("@/utils/currencies");
class SalesDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        var _a, _b, _c;
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `AND (updated_at, tx_hash, log_index, batch_index) > (to_timestamp($/updatedAt/), $/txHash/, $/logIndex/, $/batchIndex/)`;
        }
        //Only get records that are older than 5 min to take removed blocks into consideration.
        const query = `
        SELECT
          contract,
          token_id,
          order_id,
          order_kind,
          order_side,
          order_source_id_int,
          maker,
          taker,
          amount,
          fill_source_id,
          aggregator_source_id,
          tx_hash,
          timestamp,
          currency,
          price,
          currency_price,
          usd_price,
          block,
          log_index,
          batch_index,
          wash_trading_score,
          is_primary,
          created_at,
          extract(epoch from updated_at) updated_ts
        FROM fill_events_2
        WHERE updated_at < NOW() - INTERVAL '5 minutes'
        ${continuationFilter}
        ORDER BY updated_at, tx_hash, log_index, batch_index
        LIMIT $/limit/;  
      `;
        const result = await db_1.redb.manyOrNone(query, {
            updatedAt: cursor === null || cursor === void 0 ? void 0 : cursor.updatedAt,
            txHash: (cursor === null || cursor === void 0 ? void 0 : cursor.txHash) ? (0, utils_1.toBuffer)(cursor.txHash) : null,
            logIndex: cursor === null || cursor === void 0 ? void 0 : cursor.logIndex,
            batchIndex: cursor === null || cursor === void 0 ? void 0 : cursor.batchIndex,
            limit,
        });
        if (result.length) {
            const sources = await sources_1.Sources.getInstance();
            const data = [];
            for (const r of result) {
                const orderSource = r.order_source_id_int !== null ? sources.get(Number(r.order_source_id_int)) : null;
                const fillSource = r.fill_source_id !== null ? sources.get(Number(r.fill_source_id)) : null;
                const aggregatorSource = r.aggregator_source_id !== null ? sources.get(Number(r.aggregator_source_id)) : null;
                const currency = await (0, currencies_1.getCurrency)((0, utils_1.fromBuffer)(r.currency) === constants_1.AddressZero
                    ? r.order_side === "sell"
                        ? Sdk.Common.Addresses.Eth[index_2.config.chainId]
                        : Sdk.Common.Addresses.Weth[index_2.config.chainId]
                    : (0, utils_1.fromBuffer)(r.currency));
                const currencyPrice = (_a = r.currency_price) !== null && _a !== void 0 ? _a : r.price;
                data.push({
                    id: crypto_1.default
                        .createHash("sha256")
                        .update(`${(0, utils_1.fromBuffer)(r.tx_hash)}${r.maker}${r.taker}${r.contract}${r.token_id}${r.price}`)
                        .digest("hex"),
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    token_id: r.token_id,
                    order_id: r.order_id,
                    order_kind: r.order_kind,
                    order_side: r.order_side === "sell" ? "ask" : "bid",
                    order_source: (_b = orderSource === null || orderSource === void 0 ? void 0 : orderSource.domain) !== null && _b !== void 0 ? _b : null,
                    from: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.maker) : (0, utils_1.fromBuffer)(r.taker),
                    to: r.order_side === "sell" ? (0, utils_1.fromBuffer)(r.taker) : (0, utils_1.fromBuffer)(r.maker),
                    price: r.price ? r.price.toString() : null,
                    usd_price: r.usd_price,
                    currency_address: currency.contract,
                    currency_symbol: currency.symbol,
                    currency_price: currencyPrice ? currencyPrice.toString() : null,
                    amount: Number(r.amount),
                    fill_source: (_c = fillSource === null || fillSource === void 0 ? void 0 : fillSource.domain) !== null && _c !== void 0 ? _c : orderSource === null || orderSource === void 0 ? void 0 : orderSource.domain,
                    aggregator_source: aggregatorSource === null || aggregatorSource === void 0 ? void 0 : aggregatorSource.domain,
                    wash_trading_score: Number(r.wash_trading_score),
                    is_primary: Boolean(r.is_primary),
                    tx_hash: (0, utils_1.fromBuffer)(r.tx_hash),
                    tx_log_index: r.log_index,
                    tx_batch_index: r.batch_index,
                    tx_timestamp: r.timestamp,
                    created_at: new Date(r.created_at).toISOString(),
                    updated_at: new Date(r.updated_ts * 1000).toISOString(),
                });
            }
            const lastResult = result[result.length - 1];
            return {
                data,
                nextCursor: {
                    updatedAt: lastResult.updated_ts,
                    txHash: (0, utils_1.fromBuffer)(lastResult.tx_hash),
                    logIndex: lastResult.log_index,
                    batchIndex: lastResult.batch_index,
                },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.SalesDataSource = SalesDataSource;
//# sourceMappingURL=sales.js.map