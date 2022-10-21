"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskEventsDataSource = void 0;
const db_1 = require("@/common/db");
const sources_1 = require("@/models/sources");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
class AskEventsDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `WHERE id > $/id/`;
        }
        const query = `
            SELECT
              order_events.id,
              order_events.kind,
              order_events.status,
              order_events.contract,
              order_events.token_id,
              order_events.order_id,
              order_events.order_quantity_remaining,
              order_events.maker,
              order_events.price,
              order_events.order_source_id_int,
              coalesce(
                nullif(date_part('epoch', upper(order_events.order_valid_between)), 'Infinity'),
                0
              ) AS valid_until,
              date_part('epoch', lower(order_events.order_valid_between)) AS valid_from,
              order_events.tx_hash,
              order_events.tx_timestamp,
              extract(epoch from order_events.created_at) AS created_at
            FROM order_events
            ${continuationFilter}
            ORDER BY id 
            LIMIT $/limit/;
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
                    status: r.status,
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    token_id: r.token_id,
                    order_id: r.order_id,
                    maker: r.maker ? (0, utils_1.fromBuffer)(r.maker) : null,
                    price: r.price ? r.price.toString() : null,
                    quantity_remaining: Number(r.order_quantity_remaining),
                    valid_from: r.valid_from ? Number(r.valid_from) : null,
                    valid_until: r.valid_until ? Number(r.valid_until) : null,
                    source: (_a = sources.get(r.order_source_id_int)) === null || _a === void 0 ? void 0 : _a.name,
                    tx_hash: r.tx_hash ? (0, utils_1.fromBuffer)(r.tx_hash) : null,
                    tx_timestamp: r.tx_timestamp ? Number(r.tx_timestamp) : null,
                    created_at: new Date(r.created_at * 1000).toISOString(),
                });
            });
            const lastResult = result[result.length - 1];
            return {
                data,
                nextCursor: { id: lastResult.id },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.AskEventsDataSource = AskEventsDataSource;
//# sourceMappingURL=ask-events.js.map