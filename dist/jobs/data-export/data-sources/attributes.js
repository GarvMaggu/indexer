"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributesDataSource = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
const lodash_1 = __importDefault(require("lodash"));
class AttributesDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        const updatesCursor = cursor === null || cursor === void 0 ? void 0 : cursor.updates;
        const removalsCursor = cursor === null || cursor === void 0 ? void 0 : cursor.removals;
        let updatesContinuationFilter = "";
        if (updatesCursor) {
            updatesContinuationFilter = `WHERE (updated_at, id) > (to_timestamp($/updatedAt/), $/id/)`;
        }
        const updatedQuery = `
        SELECT
          id,
          attribute_key_id,
          value,
          token_count,
          on_sale_count,
          floor_sell_value,
          top_buy_value,
          sell_updated_at,
          buy_updated_at,
          collection_id,
          kind,
          key,
          created_at,
          extract(epoch from updated_at) updated_ts
        FROM attributes
        ${updatesContinuationFilter}
        ORDER BY updated_at, id
        LIMIT $/limit/;  
      `;
        const updatedResult = await db_1.redb.manyOrNone(updatedQuery, {
            id: updatesCursor === null || updatesCursor === void 0 ? void 0 : updatesCursor.id,
            updatedAt: updatesCursor === null || updatesCursor === void 0 ? void 0 : updatesCursor.updatedAt,
            limit,
        });
        let removalsContinuationFilter = "";
        if (removalsCursor) {
            removalsContinuationFilter = `WHERE (deleted_at, id) > (to_timestamp($/deletedAt/), $/id/)`;
        }
        const removedQuery = `
        SELECT
          id,
          attribute_key_id,
          value,
          token_count,
          on_sale_count,
          floor_sell_value,
          top_buy_value,
          sell_updated_at,
          buy_updated_at,
          collection_id,
          kind,
          key,
          created_at,
          extract(epoch from deleted_at) deleted_ts
        FROM removed_attributes
        ${removalsContinuationFilter}
        ORDER BY deleted_at, id
        LIMIT $/limit/;  
      `;
        const removedResult = await db_1.redb.manyOrNone(removedQuery, {
            id: removalsCursor === null || removalsCursor === void 0 ? void 0 : removalsCursor.id,
            deletedAt: removalsCursor === null || removalsCursor === void 0 ? void 0 : removalsCursor.deletedAt,
            limit,
        });
        if (updatedResult.length || removedResult.length) {
            const updatedAttributes = updatedResult.map((r) => ({
                id: r.id,
                attribute_key_id: r.attribute_key_id,
                value: r.attribute_key_id,
                token_count: Number(r.token_count),
                on_sale_count: Number(r.on_sale_count),
                floor_sell_value: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                sell_updated_at: r.sell_updated_at ? new Date(r.sell_updated_at).toISOString() : null,
                collection_id: r.collection_id,
                kind: r.kind,
                key: r.key,
                created_at: new Date(r.created_at).toISOString(),
                updated_at: new Date(r.updated_ts * 1000).toISOString(),
                is_active: true,
            }));
            let nextUpdatesCursor = lodash_1.default.clone(updatesCursor);
            if (updatedResult.length) {
                const lastUpdatedResult = updatedResult[updatedResult.length - 1];
                nextUpdatesCursor = {
                    id: lastUpdatedResult.id,
                    updatedAt: lastUpdatedResult.updated_ts,
                };
            }
            const removedAttributes = removedResult.map((r) => ({
                id: r.id,
                attribute_key_id: r.attribute_key_id,
                value: r.attribute_key_id,
                token_count: Number(r.token_count),
                on_sale_count: Number(r.on_sale_count),
                floor_sell_value: r.floor_sell_value ? r.floor_sell_value.toString() : null,
                sell_updated_at: r.sell_updated_at ? new Date(r.sell_updated_at).toISOString() : null,
                collection_id: r.collection_id,
                kind: r.kind,
                key: r.key,
                created_at: new Date(r.created_at).toISOString(),
                updated_at: new Date(r.deleted_ts * 1000).toISOString(),
                is_active: false,
            }));
            let nextRemovalsCursor = lodash_1.default.clone(removalsCursor);
            if (removedResult.length) {
                const lastRemovedResult = removedResult[removedResult.length - 1];
                nextRemovalsCursor = {
                    id: lastRemovedResult.id,
                    deletedAt: lastRemovedResult.deleted_ts,
                };
            }
            return {
                data: updatedAttributes.concat(removedAttributes),
                nextCursor: {
                    updates: nextUpdatesCursor,
                    removals: nextRemovalsCursor,
                },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.AttributesDataSource = AttributesDataSource;
//# sourceMappingURL=attributes.js.map