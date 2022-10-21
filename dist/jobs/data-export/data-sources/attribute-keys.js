"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributeKeysDataSource = void 0;
const db_1 = require("@/common/db");
const index_1 = require("@/jobs/data-export/data-sources/index");
const lodash_1 = __importDefault(require("lodash"));
class AttributeKeysDataSource extends index_1.BaseDataSource {
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
          collection_id,
          key,
          kind,
          rank,
          created_at,
          extract(epoch from updated_at) updated_ts
        FROM attribute_keys
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
          collection_id,
          key,
          kind,
          rank,
          created_at,
          extract(epoch from deleted_at) deleted_ts
        FROM removed_attribute_keys
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
            const updatedAttributeKeys = updatedResult.map((r) => ({
                id: r.id,
                collection_id: r.collection_id,
                key: r.key,
                kind: r.kind,
                rank: r.rank,
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
            const removedAttributeKeys = removedResult.map((r) => ({
                id: r.id,
                collection_id: r.collection_id,
                key: r.key,
                kind: r.kind,
                rank: r.rank,
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
                data: updatedAttributeKeys.concat(removedAttributeKeys),
                nextCursor: {
                    updates: nextUpdatesCursor,
                    removals: nextRemovalsCursor,
                },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.AttributeKeysDataSource = AttributeKeysDataSource;
//# sourceMappingURL=attribute-keys.js.map