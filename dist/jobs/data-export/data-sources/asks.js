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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsksDataSource = void 0;
const db_1 = require("@/common/db");
const sources_1 = require("@/models/sources");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const index_2 = require("@/config/index");
const currencies_1 = require("@/utils/currencies");
const constants_1 = require("@ethersproject/constants");
class AsksDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        var _a, _b, _c;
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `AND (updated_at, id) > (to_timestamp($/updatedAt/), $/id/)`;
        }
        const query = `
        SELECT
          orders.id,
          orders.kind,
          orders.side,
          orders.token_set_id,
          orders.contract,
          orders.maker,
          orders.taker,
          orders.price,
          orders.currency,
          orders.currency_price,
          COALESCE(orders.dynamic, FALSE) AS dynamic,
          orders.quantity_filled,
          orders.quantity_remaining,
          DATE_PART('epoch', LOWER(orders.valid_between)) AS valid_from,
          COALESCE(
            NULLIF(DATE_PART('epoch', UPPER(orders.valid_between)), 'Infinity'),
            0
          ) AS valid_until,
          orders.nonce,
          orders.source_id_int,
          orders.fee_bps,
          COALESCE(
            NULLIF(DATE_PART('epoch', orders.expiration), 'Infinity'),
            0
          ) AS expiration,
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
          orders.raw_data,
          orders.created_at,
          extract(epoch from orders.updated_at) updated_ts
        FROM orders
        WHERE orders.side = 'sell'
        ${continuationFilter}
        ORDER BY updated_at, id
        LIMIT $/limit/;
      `;
        const result = await db_1.redb.manyOrNone(query, {
            id: cursor === null || cursor === void 0 ? void 0 : cursor.id,
            updatedAt: cursor === null || cursor === void 0 ? void 0 : cursor.updatedAt,
            limit,
        });
        if (result.length) {
            const sources = await sources_1.Sources.getInstance();
            const data = [];
            for (const r of result) {
                const currency = await (0, currencies_1.getCurrency)((0, utils_1.fromBuffer)(r.currency) === constants_1.AddressZero
                    ? Sdk.Common.Addresses.Eth[index_2.config.chainId]
                    : (0, utils_1.fromBuffer)(r.currency));
                const currencyPrice = (_a = r.currency_price) !== null && _a !== void 0 ? _a : r.price;
                const [, , tokenId] = r.token_set_id.split(":");
                let startPrice = r.price;
                let endPrice = r.price;
                switch (r.kind) {
                    case "wyvern-v2.3": {
                        const wyvernOrder = new Sdk.WyvernV23.Order(index_2.config.chainId, r.raw_data);
                        startPrice = wyvernOrder.getMatchingPrice(r.valid_from);
                        endPrice = wyvernOrder.getMatchingPrice(r.valid_until);
                        break;
                    }
                    case "seaport": {
                        const seaportOrder = new Sdk.Seaport.Order(index_2.config.chainId, r.raw_data);
                        startPrice = seaportOrder.getMatchingPrice(r.valid_from);
                        endPrice = seaportOrder.getMatchingPrice(r.valid_until);
                        break;
                    }
                }
                data.push({
                    id: r.id,
                    kind: r.kind,
                    status: r.status,
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    token_id: tokenId,
                    maker: (0, utils_1.fromBuffer)(r.maker),
                    taker: (0, utils_1.fromBuffer)(r.taker),
                    price: r.price.toString(),
                    currency_address: currency.contract,
                    currency_symbol: currency.symbol,
                    currency_price: currencyPrice ? currencyPrice.toString() : null,
                    start_price: startPrice.toString(),
                    end_price: endPrice.toString(),
                    dynamic: r.dynamic,
                    quantity: Number(r.quantity_filled) + Number(r.quantity_remaining),
                    quantity_filled: Number(r.quantity_filled),
                    quantity_remaining: Number(r.quantity_remaining),
                    valid_from: Number(r.valid_from),
                    valid_until: Number(r.valid_until),
                    nonce: Number(r.nonce),
                    source: (_b = sources.get(r.source_id_int)) === null || _b === void 0 ? void 0 : _b.domain,
                    fee_bps: Number(r.fee_bps),
                    expiration: Number(r.expiration),
                    raw_data: (_c = r.raw_data) !== null && _c !== void 0 ? _c : null,
                    created_at: new Date(r.created_at).toISOString(),
                    updated_at: new Date(r.updated_ts * 1000).toISOString(),
                });
            }
            const lastResult = result[result.length - 1];
            return {
                data,
                nextCursor: {
                    id: lastResult.id,
                    updatedAt: lastResult.updated_ts,
                },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.AsksDataSource = AsksDataSource;
//# sourceMappingURL=asks.js.map