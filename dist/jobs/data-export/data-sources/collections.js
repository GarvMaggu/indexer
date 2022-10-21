"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionsDataSource = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
class CollectionsDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        let continuationFilter = "";
        if (cursor) {
            continuationFilter = `WHERE (updated_at, id) > (to_timestamp($/updatedAt/), $/id/)`;
        }
        const query = `
        SELECT
          collections.id,
          collections.slug,
          collections.name,
          (collections.metadata ->> 'description')::TEXT AS "description",
          collections.contract,
          collections.token_count,
          collections.floor_sell_value,
          collections.day1_volume,
          collections.day7_volume,
          collections.day30_volume,
          collections.all_time_volume,
          collections.day1_rank,
          collections.day7_rank,
          collections.day30_rank,
          collections.all_time_rank,
          collections.day1_volume_change,
          collections.day7_volume_change,
          collections.day30_volume_change,
          collections.day1_floor_sell_value,
          collections.day7_floor_sell_value,
          collections.day30_floor_sell_value,
          collections.created_at,
          extract(epoch from collections.updated_at) updated_ts
        FROM collections
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
            const data = result.map((r) => ({
                id: r.id,
                slug: r.slug,
                name: r.name,
                description: r.description,
                token_count: String(r.token_count),
                contract: (0, utils_1.fromBuffer)(r.contract),
                day1_rank: r.day1_rank,
                day7_rank: r.day7_rank,
                day30_rank: r.day30_rank,
                all_time_rank: r.all_time_rank,
                day1_volume: r.day1_volume ? r.day1_volume.toString() : null,
                day7_volume: r.day7_volume ? r.day7_volume.toString() : null,
                day30_volume: r.day30_volume ? r.day30_volume.toString() : null,
                all_time_volume: r.all_time_volume ? r.all_time_volume.toString() : null,
                day1_volume_change: r.day1_volume_change,
                day7_volume_change: r.day7_volume_change,
                day30_volume_change: r.day30_volume_change,
                floor_ask_value: r.floor_sell_value ? r.floor_sell_value.toString() : null,
                day1_floor_sale_value: r.day1_floor_sell_value ? r.day1_floor_sell_value.toString() : null,
                day7_floor_sale_value: r.day7_floor_sell_value ? r.day7_floor_sell_value.toString() : null,
                day30_floor_sale_value: r.day30_floor_sell_value
                    ? r.day30_floor_sell_value.toString()
                    : null,
                day1_floor_sale_change: r.day1_floor_sell_value
                    ? Number(r.floor_sell_value) / Number(r.day1_floor_sell_value)
                    : null,
                day7_floor_sale_change: r.day7_floor_sell_value
                    ? Number(r.floor_sell_value) / Number(r.day7_floor_sell_value)
                    : null,
                day30_floor_sale_change: r.day30_floor_sell_value
                    ? Number(r.floor_sell_value) / Number(r.day30_floor_sell_value)
                    : null,
                created_at: new Date(r.created_at).toISOString(),
                updated_at: new Date(r.updated_ts * 1000).toISOString(),
            }));
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
exports.CollectionsDataSource = CollectionsDataSource;
//# sourceMappingURL=collections.js.map