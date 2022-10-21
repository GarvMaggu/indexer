"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributeKeys = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
class AttributeKeys {
    static async update(collectionId, key, fields) {
        let updateString = "";
        const replacementValues = {
            collectionId,
            key,
        };
        lodash_1.default.forEach(fields, (value, fieldName) => {
            updateString += `${lodash_1.default.snakeCase(fieldName)} = $/${fieldName}/,`;
            replacementValues[fieldName] = value;
        });
        updateString = lodash_1.default.trimEnd(updateString, ",");
        const query = `UPDATE attribute_keys
                   SET updated_at = now(),
                       ${updateString}
                   WHERE collection_id = $/collectionId/
                   AND key = $/key/`;
        return await db_1.idb.none(query, replacementValues);
    }
    static async delete(collectionId, key) {
        const replacementValues = {
            collectionId,
            key,
        };
        const query = `WITH x AS (
                    DELETE FROM attribute_keys
                    WHERE collection_id = $/collectionId/
                    AND key = $/key/
                    RETURNING id, collection_id, key, kind, rank, attribute_count, info, created_at
                   ) INSERT INTO removed_attribute_keys SELECT * FROM x;`;
        return await db_1.idb.none(query, replacementValues);
    }
    static async getKeysCount(collectionId) {
        const query = `
        SELECT count(*) AS "count"
        FROM attribute_keys
        WHERE collection_id = $/collectionId/
    `;
        return (await db_1.redb.one(query, { collectionId })).count;
    }
}
exports.AttributeKeys = AttributeKeys;
//# sourceMappingURL=index.js.map