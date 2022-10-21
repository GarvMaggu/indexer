"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionSets = void 0;
const lodash_1 = __importDefault(require("lodash"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@/common/db");
class CollectionSets {
    static getCollectionsSetId(collectionIds) {
        return crypto_1.default.createHash("sha256").update(lodash_1.default.sortBy(collectionIds).toString()).digest("hex");
    }
    static async add(collectionIds) {
        // Sort the collections and create a unique hash
        const collectionsHash = CollectionSets.getCollectionsSetId(collectionIds);
        let query = `
      INSERT INTO collections_sets (collections_hash)
      VALUES ($/collectionsHash/)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
        await db_1.idb.oneOrNone(query, {
            collectionsHash,
        });
        const replacementParams = {};
        let assignCollectionToSetString = "";
        lodash_1.default.forEach(collectionIds, (collectionId, index) => {
            replacementParams[`${index}`] = collectionId;
            assignCollectionToSetString += `('${collectionsHash}', $/${index}/),`;
        });
        assignCollectionToSetString = lodash_1.default.trimEnd(assignCollectionToSetString, ",");
        query = `
        INSERT INTO collections_sets_collections (collections_set_id, collection_id)
        VALUES ${assignCollectionToSetString}
        ON CONFLICT DO NOTHING
    `;
        await db_1.idb.none(query, replacementParams);
        return collectionsHash;
    }
    static async getCollectionsIds(collectionsSetId) {
        const query = `
      SELECT collection_id
      FROM collections_sets_collections
      WHERE collections_set_id = $/collectionsSetId/
    `;
        const collections = await db_1.redb.manyOrNone(query, { collectionsSetId });
        return lodash_1.default.map(collections, (collection) => collection.collection_id);
    }
}
exports.CollectionSets = CollectionSets;
//# sourceMappingURL=index.js.map