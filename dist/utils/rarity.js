"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rarity = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const rankings_1 = require("@poprank/rankings");
class Rarity {
    static async getCollectionTokensRarity(collectionId) {
        const limit = 1000;
        let values = {
            collectionId,
        };
        let fetchMoreTokens = true;
        let tokens = [];
        // Filter any keys with more than 5000 distinct values
        const valuesCount = await Rarity.getValuesCount(collectionId);
        const excludedKeys = [];
        lodash_1.default.map(valuesCount, (value) => (value.count > 5000 ? excludedKeys.push(value.key) : null));
        let lastTokenId;
        // Get all tokens and their attributes for the given collection
        while (fetchMoreTokens) {
            let continuation = "";
            let keysFilter = "";
            if (lastTokenId) {
                continuation = `AND token_id > $/tokenId/`;
                values = lodash_1.default.merge(values, { tokenId: lastTokenId });
            }
            if (lodash_1.default.size(excludedKeys)) {
                keysFilter = `AND key NOT IN ('${lodash_1.default.join(excludedKeys, "','")}')`;
            }
            const query = `
        SELECT token_id AS "tokenId",
               array_agg(json_build_object('key', key, 'value', value)) AS "attributes"
        FROM token_attributes
        WHERE collection_id = $/collectionId/
        ${keysFilter}
        ${continuation}
        GROUP BY contract, token_id
        ORDER BY token_id ASC
        LIMIT ${limit}
    `;
            const result = await db_1.redb.manyOrNone(query, values);
            if (lodash_1.default.size(result)) {
                lastTokenId = lodash_1.default.last(result).tokenId;
            }
            tokens = lodash_1.default.concat(tokens, result);
            fetchMoreTokens = lodash_1.default.size(result) >= limit;
        }
        if (lodash_1.default.isEmpty(tokens)) {
            return [];
        }
        // Build an array for the rarity calculation, some of the fields are not relevant for the calculation but needs to be passed
        const nfts = lodash_1.default.map(tokens, (result) => {
            const traits = lodash_1.default.map(result.attributes, (attribute) => ({
                typeValue: attribute.key,
                value: attribute.value,
                category: "Traits",
                displayType: null,
            }));
            traits.push({
                typeValue: "Trait Count",
                value: `${lodash_1.default.size(traits)}`,
                category: "Meta",
                displayType: null,
            });
            return {
                collection: collectionId,
                id: result.tokenId,
                name: "",
                address: collectionId,
                imageUrl: "",
                metadataUrl: "",
                rating: 0,
                timesSeen: 0,
                timesWon: 0,
                aestheticRank: 0,
                traits,
            };
        });
        // Get the score for the tokens and return
        const { nftsWithRarityAndRank } = (0, rankings_1.getAllNftsRarity)(nfts);
        return nftsWithRarityAndRank;
    }
    static async getValuesCount(collectionId) {
        const query = `
      SELECT key, count(DISTINCT value) AS "count"
      FROM token_attributes
      WHERE collection_id = $/collectionId/
      GROUP BY key
    `;
        return await db_1.redb.manyOrNone(query, { collectionId });
    }
}
exports.Rarity = Rarity;
//# sourceMappingURL=rarity.js.map