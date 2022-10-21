"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenFloorAskEventsDataSource = void 0;
const db_1 = require("@/common/db");
const sources_1 = require("@/models/sources");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
class TokenFloorAskEventsDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `WHERE id > $/id/`;
        }
        const query = `
      SELECT
        token_floor_sell_events.source_id_int,
        date_part('epoch', lower(token_floor_sell_events.valid_between)) AS valid_from,
        coalesce(
          nullif(date_part('epoch', upper(token_floor_sell_events.valid_between)), 'Infinity'),
          0
        ) AS valid_until,
        token_floor_sell_events.nonce,
        token_floor_sell_events.id,
        token_floor_sell_events.kind,
        token_floor_sell_events.contract,
        token_floor_sell_events.token_id,
        token_floor_sell_events.order_id,
        token_floor_sell_events.maker,
        token_floor_sell_events.price,
        token_floor_sell_events.previous_price,
        token_floor_sell_events.tx_hash,
        token_floor_sell_events.tx_timestamp,
        extract(epoch from token_floor_sell_events.created_at) AS created_at
      FROM token_floor_sell_events
      ${continuationFilter}
      ORDER BY id 
      LIMIT $/limit/
  `;
        const result = await db_1.redb.manyOrNone(query, {
            id: cursor === null || cursor === void 0 ? void 0 : cursor.id,
            limit,
        });
        if (result.length) {
            const sources = await sources_1.Sources.getInstance();
            const data = result.map((r) => {
                var _a;
                return ({
                    id: r.id,
                    kind: r.kind,
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    token_id: r.token_id,
                    order_id: r.order_id,
                    maker: r.maker ? (0, utils_1.fromBuffer)(r.maker) : null,
                    price: r.price ? r.price.toString() : null,
                    previous_price: r.previous_price ? r.previous_price.toString() : null,
                    nonce: r.nonce,
                    valid_from: r.valid_from ? Number(r.valid_from) : null,
                    valid_until: r.valid_until ? Number(r.valid_until) : null,
                    source: (_a = sources.get(r.source_id_int)) === null || _a === void 0 ? void 0 : _a.name,
                    tx_hash: r.tx_hash ? (0, utils_1.fromBuffer)(r.tx_hash) : null,
                    tx_timestamp: r.tx_timestamp ? Number(r.tx_timestamp) : null,
                    created_at: new Date(r.created_at * 1000).toISOString(),
                });
            });
            const lastResult = result[result.length - 1];
            return {
                data,
                nextCursor: {
                    id: lastResult.id,
                    updatedAt: lastResult.updated_at,
                },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.TokenFloorAskEventsDataSource = TokenFloorAskEventsDataSource;
//# sourceMappingURL=token-floor-ask-events.js.map