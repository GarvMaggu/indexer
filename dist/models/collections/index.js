"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collections = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const collections_entity_1 = require("@/models/collections/collections-entity");
const tokens_1 = require("@/models/tokens");
const metadata_api_1 = __importDefault(require("@/utils/metadata-api"));
class Collections {
    static async getById(collectionId, readReplica = false) {
        const dbInstance = readReplica ? db_1.redb : db_1.idb;
        const collection = await dbInstance.oneOrNone(`SELECT *
              FROM collections
              WHERE id = $/collectionId/`, {
            collectionId,
        });
        if (collection) {
            return new collections_entity_1.CollectionsEntity(collection);
        }
        return null;
    }
    static async getByContractAndTokenId(contract, tokenId, readReplica = false) {
        const dbInstance = readReplica ? db_1.redb : db_1.idb;
        const collection = await dbInstance.oneOrNone(`SELECT *
              FROM collections
              WHERE contract = $/contract/
              AND token_id_range @> $/tokenId/::NUMERIC(78, 0)`, {
            contract: (0, utils_1.toBuffer)(contract),
            tokenId,
        });
        if (collection) {
            return new collections_entity_1.CollectionsEntity(collection);
        }
        return null;
    }
    static async getByTokenSetId(tokenSetId) {
        const collection = await db_1.redb.oneOrNone(`SELECT *
              FROM collections
              WHERE token_set_id = $/tokenSetId/`, {
            tokenSetId,
        });
        if (collection) {
            return new collections_entity_1.CollectionsEntity(collection);
        }
        return null;
    }
    static async updateCollectionCache(contract, tokenId) {
        const collection = await metadata_api_1.default.getCollectionMetadata(contract, tokenId);
        const tokenCount = await tokens_1.Tokens.countTokensInCollection(collection.id);
        const query = `UPDATE collections
                   SET metadata = $/metadata:json/, name = $/name/, royalties = $/royalties:json/,
                       slug = $/slug/, token_count = $/tokenCount/, updated_at = now()
                   WHERE id = $/id/`;
        const values = {
            id: collection.id,
            metadata: collection.metadata || {},
            name: collection.name,
            royalties: collection.royalties || [],
            slug: collection.slug,
            tokenCount,
        };
        await db_1.idb.none(query, values);
    }
    static async update(collectionId, fields) {
        let updateString = "";
        const replacementValues = {
            collectionId,
        };
        lodash_1.default.forEach(fields, (value, fieldName) => {
            updateString += `${lodash_1.default.snakeCase(fieldName)} = $/${fieldName}/,`;
            replacementValues[fieldName] = value;
        });
        updateString = lodash_1.default.trimEnd(updateString, ",");
        const query = `UPDATE collections
                   SET ${updateString}
                   WHERE id = $/collectionId/`;
        return await db_1.idb.none(query, replacementValues);
    }
    static async getCollectionsMintedBetween(from, to, limit = 2000) {
        const query = `SELECT *
                   FROM collections
                   WHERE minted_timestamp > ${from}
                   AND minted_timestamp < ${to}
                   ORDER BY minted_timestamp ASC
                   LIMIT ${limit}`;
        const collections = await db_1.redb.manyOrNone(query);
        if (!lodash_1.default.isEmpty(collections)) {
            return lodash_1.default.map(collections, (collection) => new collections_entity_1.CollectionsEntity(collection));
        }
        return [];
    }
    static async getTopCollectionsByVolume(limit = 500) {
        const query = `SELECT *
                   FROM collections
                   ORDER BY day1_volume DESC
                   LIMIT ${limit}`;
        const collections = await db_1.redb.manyOrNone(query);
        if (!lodash_1.default.isEmpty(collections)) {
            return lodash_1.default.map(collections, (collection) => new collections_entity_1.CollectionsEntity(collection));
        }
        return [];
    }
    static async recalculateCollectionFloorSell(collection) {
        const query = `
      UPDATE collections SET
        floor_sell_id = x.floor_sell_id,
        floor_sell_value = x.floor_sell_value,
        floor_sell_maker = x.floor_sell_maker,
        floor_sell_source_id_int = x.source_id_int,
        floor_sell_valid_between = x.valid_between,
        updated_at = now()
      FROM (
        SELECT
          tokens.floor_sell_id,
          tokens.floor_sell_value,
          tokens.floor_sell_maker,
          orders.source_id_int,
          orders.valid_between
        FROM tokens
        JOIN orders
        ON tokens.floor_sell_id = orders.id
        WHERE tokens.collection_id = $/collection/
        ORDER BY tokens.floor_sell_value
        LIMIT 1
      ) x
      WHERE collections.id = $/collection/
      AND (
        collections.floor_sell_id IS DISTINCT FROM x.floor_sell_id
        OR collections.floor_sell_value IS DISTINCT FROM x.floor_sell_value
      )
  `;
        await db_1.idb.none(query, {
            collection,
        });
    }
    static async recalculateContractFloorSell(contract) {
        const result = await db_1.redb.manyOrNone(`
        SELECT
          tokens.token_id
        FROM tokens
        WHERE tokens.contract = $/contract/
        LIMIT 10000
      `, {
            contract: (0, utils_1.toBuffer)(contract),
        });
        if (result) {
            const currentTime = (0, utils_1.now)();
            await orderUpdatesById.addToQueue(result.map(({ token_id }) => {
                const tokenSetId = `token:${contract}:${token_id}`;
                return {
                    context: `revalidate-sell-${tokenSetId}-${currentTime}`,
                    tokenSetId,
                    side: "sell",
                    trigger: { kind: "revalidation" },
                };
            }));
        }
    }
    static async recalculateContractTopBuy(contract) {
        const result = await db_1.redb.manyOrNone(`
        SELECT
          tokens.token_id
        FROM tokens
        WHERE tokens.contract = $/contract/
        LIMIT 10000
      `, {
            contract: (0, utils_1.toBuffer)(contract),
        });
        if (result) {
            const currentTime = (0, utils_1.now)();
            await orderUpdatesById.addToQueue(result.map(({ token_id }) => {
                const tokenSetId = `token:${contract}:${token_id}`;
                return {
                    context: `revalidate-buy-${tokenSetId}-${currentTime}`,
                    tokenSetId,
                    side: "buy",
                    trigger: { kind: "revalidation" },
                };
            }));
        }
    }
}
exports.Collections = Collections;
//# sourceMappingURL=index.js.map