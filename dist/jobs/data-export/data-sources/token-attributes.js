"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenAttributesDataSource = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/jobs/data-export/data-sources/index");
const crypto_1 = __importDefault(require("crypto"));
const lodash_1 = __importDefault(require("lodash"));
class TokenAttributesDataSource extends index_1.BaseDataSource {
    async getSequenceData(cursor, limit) {
        const updatesCursor = cursor === null || cursor === void 0 ? void 0 : cursor.updates;
        const removalsCursor = cursor === null || cursor === void 0 ? void 0 : cursor.removals;
        let updatesContinuationFilter = "";
        if (updatesCursor) {
            updatesContinuationFilter = `WHERE (updated_at, contract, token_id, attribute_id) > (to_timestamp($/updatedAt/), $/contract/, $/tokenId/, $/attributeId/)`;
        }
        const updatedQuery = `
        SELECT
          contract,
          token_id,
          attribute_id,
          collection_id,
          key,
          value,
          created_at,
          extract(epoch from updated_at) updated_ts
        FROM token_attributes
        ${updatesContinuationFilter}
        ORDER BY updated_at, contract, token_id, attribute_id
        LIMIT $/limit/;  
      `;
        const updatedResult = await db_1.redb.manyOrNone(updatedQuery, {
            contract: (updatesCursor === null || updatesCursor === void 0 ? void 0 : updatesCursor.contract) ? (0, utils_1.toBuffer)(updatesCursor.contract) : null,
            tokenId: updatesCursor === null || updatesCursor === void 0 ? void 0 : updatesCursor.tokenId,
            attributeId: updatesCursor === null || updatesCursor === void 0 ? void 0 : updatesCursor.attributeId,
            updatedAt: updatesCursor === null || updatesCursor === void 0 ? void 0 : updatesCursor.updatedAt,
            limit,
        });
        let removalsContinuationFilter = "";
        if (removalsCursor) {
            removalsContinuationFilter = `WHERE (deleted_at, contract, token_id, attribute_id) > (to_timestamp($/deletedAt/), $/contract/, $/tokenId/, $/attributeId/)`;
        }
        const removedQuery = `
        SELECT
          contract,
          token_id,
          attribute_id,
          collection_id,
          key,
          value,
          created_at,
          extract(epoch from deleted_at) deleted_ts
        FROM removed_token_attributes
        ${removalsContinuationFilter}
        ORDER BY deleted_at, contract, token_id, attribute_id
        LIMIT $/limit/;  
      `;
        const removedResult = await db_1.redb.manyOrNone(removedQuery, {
            contract: (removalsCursor === null || removalsCursor === void 0 ? void 0 : removalsCursor.contract) ? (0, utils_1.toBuffer)(removalsCursor.contract) : null,
            tokenId: removalsCursor === null || removalsCursor === void 0 ? void 0 : removalsCursor.tokenId,
            attributeId: removalsCursor === null || removalsCursor === void 0 ? void 0 : removalsCursor.attributeId,
            deletedAt: removalsCursor === null || removalsCursor === void 0 ? void 0 : removalsCursor.deletedAt,
            limit,
        });
        if (updatedResult.length || removedResult.length) {
            const updatedTokenAttributes = updatedResult.map((r) => ({
                id: crypto_1.default
                    .createHash("sha256")
                    .update(`${(0, utils_1.fromBuffer)(r.contract)}${r.token_id}${r.attribute_id}`)
                    .digest("hex"),
                contract: (0, utils_1.fromBuffer)(r.contract),
                token_id: r.token_id,
                attribute_id: r.attribute_id,
                collection_id: r.collection_id,
                key: r.key,
                value: r.value,
                created_at: new Date(r.created_at).toISOString(),
                updated_at: new Date(r.updated_ts * 1000).toISOString(),
                is_active: true,
            }));
            let nextUpdatesCursor = lodash_1.default.clone(updatesCursor);
            if (updatedResult.length) {
                const lastUpdatedResult = updatedResult[updatedResult.length - 1];
                nextUpdatesCursor = {
                    contract: (0, utils_1.fromBuffer)(lastUpdatedResult.contract),
                    tokenId: lastUpdatedResult.token_id,
                    attributeId: lastUpdatedResult.attribute_id,
                    updatedAt: lastUpdatedResult.updated_ts,
                };
            }
            const removedTokenAttributes = removedResult.map((r) => ({
                id: crypto_1.default
                    .createHash("sha256")
                    .update(`${(0, utils_1.fromBuffer)(r.contract)}${r.token_id}${r.attribute_id}`)
                    .digest("hex"),
                contract: (0, utils_1.fromBuffer)(r.contract),
                token_id: r.token_id,
                attribute_id: r.attribute_id,
                collection_id: r.collection_id,
                key: r.key,
                value: r.value,
                created_at: new Date(r.created_at).toISOString(),
                updated_at: new Date(r.deleted_ts * 1000).toISOString(),
                is_active: false,
            }));
            let nextRemovalsCursor = lodash_1.default.clone(removalsCursor);
            if (removedResult.length) {
                const lastDeletedResult = removedResult[removedResult.length - 1];
                nextRemovalsCursor = {
                    contract: (0, utils_1.fromBuffer)(lastDeletedResult.contract),
                    tokenId: lastDeletedResult.token_id,
                    attributeId: lastDeletedResult.attribute_id,
                    deletedAt: lastDeletedResult.deleted_ts,
                };
            }
            return {
                data: updatedTokenAttributes.concat(removedTokenAttributes),
                nextCursor: {
                    updates: nextUpdatesCursor,
                    removals: nextRemovalsCursor,
                },
            };
        }
        return { data: [], nextCursor: null };
    }
}
exports.TokenAttributesDataSource = TokenAttributesDataSource;
//# sourceMappingURL=token-attributes.js.map