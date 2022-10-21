"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokensDataSource = void 0;
const db_1 = require("@/common/db");
const sources_1 = require("@/models/sources");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
const crypto_1 = __importDefault(require("crypto"));
class TokensDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `WHERE ("t"."updated_at", "t"."contract", "t"."token_id") > (to_timestamp($/updatedAt/), $/contract/, $/tokenId/)`;
        }
        const query = `
        SELECT
          "t"."contract",
          "t"."token_id",
          "t"."name",
          "t"."description",
          "t"."collection_id",
          "t"."last_sell_value",
          "t"."last_sell_timestamp",
          (
            SELECT "nb"."owner" FROM "nft_balances" "nb"
            WHERE "nb"."contract" = "t"."contract"
              AND "nb"."token_id" = "t"."token_id"
              AND "nb"."amount" > 0
            LIMIT 1
          ) AS "owner",
          "t"."floor_sell_id",
          "t"."floor_sell_value",
          "t"."floor_sell_maker",
          "t"."floor_sell_valid_from",
          "t"."floor_sell_valid_to",
          "t"."floor_sell_source_id_int",
          "t"."created_at",
          extract(epoch from "t"."updated_at") "updated_ts"
        FROM "tokens" "t"
        ${continuationFilter}
        ORDER BY "t"."updated_at", "t"."contract", "t"."token_id"
        LIMIT $/limit/;  
      `;
        const result = await db_1.redb.manyOrNone(query, {
            contract: (cursor === null || cursor === void 0 ? void 0 : cursor.contract) ? (0, utils_1.toBuffer)(cursor.contract) : null,
            tokenId: cursor === null || cursor === void 0 ? void 0 : cursor.tokenId,
            updatedAt: cursor === null || cursor === void 0 ? void 0 : cursor.updatedAt,
            limit,
        });
        if (result.length) {
            const sources = await sources_1.Sources.getInstance();
            const data = result.map((r) => {
                var _a;
                return ({
                    id: crypto_1.default
                        .createHash("sha256")
                        .update(`${(0, utils_1.fromBuffer)(r.contract)}${r.token_id}`)
                        .digest("hex"),
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    token_id: r.token_id,
                    name: r.name,
                    description: r.description,
                    collection_id: r.collection_id,
                    owner: r.owner ? (0, utils_1.fromBuffer)(r.owner) : null,
                    floor_ask_id: r.floor_sell_id,
                    floor_ask_value: r.floor_sell_value ? r.floor_sell_value.toString() : null,
                    floor_ask_maker: r.floor_sell_maker ? (0, utils_1.fromBuffer)(r.floor_sell_maker) : null,
                    floor_ask_valid_from: r.floor_sell_valid_from ? r.floor_sell_valid_from : null,
                    floor_ask_valid_to: r.floor_sell_valid_to ? r.floor_sell_valid_to : null,
                    floor_ask_source: (_a = sources.get(r.floor_sell_source_id_int)) === null || _a === void 0 ? void 0 : _a.name,
                    last_sale_value: r.last_sell_value ? r.last_sell_value.toString() : null,
                    last_sale_timestamp: r.last_sell_timestamp,
                    created_at: new Date(r.created_at).toISOString(),
                    updated_at: new Date(r.updated_ts * 1000).toISOString(),
                });
            });
            const lastResult = result[result.length - 1];
            return {
                data,
                nextCursor: {
                    contract: (0, utils_1.fromBuffer)(lastResult.contract),
                    tokenId: lastResult.token_id,
                    updatedAt: lastResult.updated_ts,
                },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.TokensDataSource = TokensDataSource;
//# sourceMappingURL=tokens.js.map