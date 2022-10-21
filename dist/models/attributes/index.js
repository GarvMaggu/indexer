"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attributes = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const attributes_entity_1 = require("@/models/attributes/attributes-entity");
class Attributes {
    static async incrementOnSaleCount(attributesId, incrementBy) {
        const query = `UPDATE attributes
                   SET on_sale_count = CASE WHEN on_sale_count + $/incrementBy/ <= 0 THEN 0 ELSE on_sale_count + $/incrementBy/ END, 
                       updated_at = now()
                   WHERE id IN ($/attributesId:raw/)`;
        return await db_1.idb.none(query, {
            attributesId: lodash_1.default.join(attributesId, ","),
            incrementBy,
        });
    }
    static async getById(attributeId) {
        const query = `SELECT *
                   FROM attributes
                   WHERE id = $/attributeId/`;
        const attribute = await db_1.redb.oneOrNone(query, {
            attributeId,
        });
        if (attribute) {
            return new attributes_entity_1.AttributesEntity(attribute);
        }
        return null;
    }
    static async getAttributes(attributesId) {
        const query = `SELECT *
                   FROM attributes
                   WHERE id IN ($/attributesId:raw/)`;
        const attributes = await db_1.redb.manyOrNone(query, {
            attributesId: lodash_1.default.join(attributesId, ","),
        });
        if (attributes) {
            return lodash_1.default.map(attributes, (attribute) => new attributes_entity_1.AttributesEntity(attribute));
        }
        return [];
    }
    static async update(attributeId, fields) {
        let updateString = "";
        const replacementValues = {
            attributeId,
        };
        lodash_1.default.forEach(fields, (value, fieldName) => {
            updateString += `${lodash_1.default.snakeCase(fieldName)} = $/${fieldName}/,`;
            replacementValues[fieldName] = value;
        });
        updateString = lodash_1.default.trimEnd(updateString, ",");
        const query = `UPDATE attributes
                   SET updated_at = now(),
                       ${updateString}
                   WHERE id = $/attributeId/`;
        return await db_1.idb.none(query, replacementValues);
    }
    static async delete(attributeId) {
        const replacementValues = {
            attributeId,
        };
        const query = `WITH x AS (
                    DELETE FROM attributes
                    WHERE id = $/attributeId/
                    RETURNING id, attribute_key_id, value, token_count, on_sale_count,
                              floor_sell_value, top_buy_value, sell_updated_at, buy_updated_at,
                              sample_images, collection_id, kind, key, created_at
                   ) INSERT INTO removed_attributes SELECT * FROM x;`;
        return await db_1.idb.none(query, replacementValues);
    }
    static async getAttributeByCollectionKeyValue(collectionId, key, value) {
        const replacementValues = {
            collectionId,
            key,
            value,
        };
        const query = `SELECT *
                   FROM attributes
                   WHERE collection_id = $/collectionId/
                   AND key = $/key/
                   AND value = $/value/
                   LIMIT 1`;
        const attribute = await db_1.redb.oneOrNone(query, replacementValues);
        if (attribute) {
            return new attributes_entity_1.AttributesEntity(attribute);
        }
        return null;
    }
}
exports.Attributes = Attributes;
//# sourceMappingURL=index.js.map