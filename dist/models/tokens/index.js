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
exports.Tokens = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const tokens_entity_1 = require("@/models/tokens/tokens-entity");
class Tokens {
    static async getByContractAndTokenId(contract, tokenId, readReplica = false) {
        const dbInstance = readReplica ? db_1.redb : db_1.idb;
        const token = await dbInstance.oneOrNone(`SELECT *
              FROM tokens
              WHERE contract = $/contract/
              AND token_id = $/tokenId/`, {
            contract: (0, utils_1.toBuffer)(contract),
            tokenId,
        });
        if (token) {
            return new tokens_entity_1.TokensEntity(token);
        }
        return null;
    }
    static async update(contract, tokenId, fields) {
        let updateString = "";
        const replacementValues = {
            contract: (0, utils_1.toBuffer)(contract),
            tokenId,
        };
        lodash_1.default.forEach(fields, (value, fieldName) => {
            updateString += `${lodash_1.default.snakeCase(fieldName)} = $/${fieldName}/,`;
            replacementValues[fieldName] = value;
        });
        updateString = lodash_1.default.trimEnd(updateString, ",");
        const query = `UPDATE tokens
                   SET updated_at = now(),
                   ${updateString}
                   WHERE contract = $/contract/
                   AND token_id = $/tokenId/`;
        return await db_1.idb.none(query, replacementValues);
    }
    static async getTokenAttributes(contract, tokenId) {
        const query = `SELECT attribute_id AS "attributeId", token_attributes.key, token_attributes.value, attribute_key_id AS "attributeKeyId",
                          token_attributes.collection_id AS "collectionId", floor_sell_value AS "floorSellValue"
                   FROM token_attributes
                   JOIN attributes ON token_attributes.attribute_id = attributes.id
                   WHERE contract = $/contract/
                   AND token_id = $/tokenId/`;
        return (await db_1.redb.manyOrNone(query, {
            contract: (0, utils_1.toBuffer)(contract),
            tokenId,
        }));
    }
    static async getTokenAttributesKeyCount(collection, key) {
        const query = `SELECT count(DISTINCT value) AS count
                   FROM token_attributes
                   WHERE collection_id = $/collection/
                   and key = $/key/
                   GROUP BY key`;
        return await db_1.redb.oneOrNone(query, {
            collection,
            key,
        });
    }
    static async getTokenAttributesValueCount(collection, key, value) {
        const query = `SELECT attribute_id AS "attributeId", count(*) AS count
                   FROM token_attributes
                   WHERE collection_id = $/collection/
                   AND key = $/key/
                   AND value = $/value/
                   GROUP BY key, value, attribute_id`;
        return await db_1.redb.oneOrNone(query, {
            collection,
            key,
            value,
        });
    }
    static async countTokensInCollection(collectionId) {
        const query = `SELECT count(*) AS count
                   FROM tokens
                   WHERE collection_id = $/collectionId/`;
        return await db_1.idb
            .oneOrNone(query, {
            collectionId,
        })
            .then((result) => (result ? result.count : 0));
    }
    static async getSingleToken(collectionId) {
        const query = `
        SELECT token_id
        FROM tokens
        WHERE collection_id = $/collectionId/
        LIMIT 1
      `;
        const result = await db_1.redb.oneOrNone(query, {
            collectionId,
        });
        if (result) {
            return result.token_id;
        }
        return null;
    }
    static async getTokenIdsInCollection(collectionId, contract = "", nonFlaggedOnly = false, readReplica = true) {
        const dbInstance = readReplica ? db_1.redb : db_1.idb;
        const limit = 5000;
        let checkForMore = true;
        let continuation = "";
        let tokenIds = [];
        let flagFilter = "";
        let contractFilter = "";
        if (nonFlaggedOnly) {
            flagFilter = "AND is_flagged = 0";
        }
        if (contract) {
            contractFilter = "AND contract = $/contract/";
        }
        while (checkForMore) {
            const query = `
        SELECT token_id
        FROM tokens
        WHERE collection_id = $/collectionId/
        ${contractFilter}
        ${flagFilter}
        ${continuation}
        ORDER BY token_id ASC
        LIMIT ${limit}
      `;
            const result = await dbInstance.manyOrNone(query, {
                contract: (0, utils_1.toBuffer)(contract),
                collectionId,
            });
            if (!lodash_1.default.isEmpty(result)) {
                tokenIds = lodash_1.default.concat(tokenIds, lodash_1.default.map(result, (r) => r.token_id));
                continuation = `AND token_id > ${lodash_1.default.last(result).token_id}`;
            }
            if (limit > lodash_1.default.size(result)) {
                checkForMore = false;
            }
        }
        return tokenIds;
    }
    /**
     * Return the lowest sell price and number of tokens on sale for the given attribute
     * @param collection
     * @param attributeKey
     * @param attributeValue
     */
    static async getSellFloorValueAndOnSaleCount(collection, attributeKey, attributeValue) {
        const query = `SELECT COUNT(*) AS "onSaleCount", MIN(floor_sell_value) AS "floorSellValue"
                   FROM token_attributes
                   JOIN tokens ON token_attributes.contract = tokens.contract AND token_attributes.token_id = tokens.token_id
                   WHERE token_attributes.collection_id = $/collection/
                   AND key = $/attributeKey/
                   AND value = $/attributeValue/
                   AND floor_sell_value IS NOT NULL`;
        const result = await db_1.redb.oneOrNone(query, {
            collection,
            attributeKey,
            attributeValue,
        });
        if (result) {
            return { floorSellValue: result.floorSellValue, onSaleCount: result.onSaleCount };
        }
        return { floorSellValue: null, onSaleCount: 0 };
    }
    static async recalculateTokenFloorSell(contract, tokenId) {
        const tokenSetId = `token:${contract}:${tokenId}`;
        await orderUpdatesById.addToQueue([
            {
                context: `revalidate-sell-${tokenSetId}-${(0, utils_1.now)()}`,
                tokenSetId,
                side: "sell",
                trigger: { kind: "revalidation" },
            },
        ]);
    }
    static async recalculateTokenTopBid(contract, tokenId) {
        const tokenSetId = `token:${contract}:${tokenId}`;
        await orderUpdatesById.addToQueue([
            {
                context: `revalidate-buy-${tokenSetId}-${(0, utils_1.now)()}`,
                tokenSetId,
                side: "buy",
                trigger: { kind: "revalidation" },
            },
        ]);
    }
    /**
     * Get top bid for the given tokens within a single contract
     * @param contract
     * @param tokenIds
     */
    static async getTokensTopBid(contract, tokenIds) {
        const query = `
      SELECT "x"."contract", "x"."token_id", "y"."order_id", "y"."value", "y"."maker"
      FROM (
        SELECT contract, token_id
        FROM tokens
        WHERE contract = $/contract/
        AND token_id IN ($/tokenIds:csv/)
        ORDER BY contract, token_id ASC
      ) "x" LEFT JOIN LATERAL (
        SELECT
          "o"."id" as "order_id",
          "o"."value",
          "o"."maker"
        FROM "orders" "o"
        JOIN "token_sets_tokens" "tst" ON "o"."token_set_id" = "tst"."token_set_id"
        WHERE "tst"."contract" = "x"."contract"
        AND "tst"."token_id" = "x"."token_id"
        AND "o"."side" = 'buy'
        AND "o"."fillability_status" = 'fillable'
        AND "o"."approval_status" = 'approved'
        AND EXISTS(
          SELECT FROM "nft_balances" "nb"
            WHERE "nb"."contract" = "x"."contract"
            AND "nb"."token_id" = "x"."token_id"
            AND "nb"."amount" > 0
            AND "nb"."owner" != "o"."maker"
        )
        ORDER BY "o"."value" DESC
        LIMIT 1
      ) "y" ON TRUE
    `;
        const result = await db_1.redb.manyOrNone(query, {
            contract: (0, utils_1.toBuffer)(contract),
            tokenIds,
        });
        return lodash_1.default.map(result, (r) => ({
            contract: r.contract ? (0, utils_1.fromBuffer)(r.contract) : null,
            tokenId: r.token_id,
            orderId: r.order_id,
            value: r.value,
            maker: r.maker ? (0, utils_1.fromBuffer)(r.maker) : null,
        }));
    }
    /**
     * Get top bids for tokens within multiple contracts, this is not the most efficient query, if the intention is to get
     * top bid for tokens which are all in the same contract, better to use getTokensTopBid
     * @param tokens
     */
    static async getMultipleContractsTokensTopBid(tokens) {
        let tokensFilter = "";
        const values = {};
        let i = 0;
        lodash_1.default.map(tokens, (token) => {
            tokensFilter += `($/contract${i}/, $/token${i}/),`;
            values[`contract${i}`] = (0, utils_1.toBuffer)(token.contract);
            values[`token${i}`] = token.tokenId;
            ++i;
        });
        tokensFilter = lodash_1.default.trimEnd(tokensFilter, ",");
        const query = `
      SELECT "x"."contract", "x"."token_id", "y"."order_id", "y"."value", "y"."maker"
      FROM (
        SELECT contract, token_id
        FROM tokens
        WHERE (contract, token_id) IN (${tokensFilter})
        ORDER BY contract, token_id ASC
      ) "x" LEFT JOIN LATERAL (
        SELECT
          "o"."id" as "order_id",
          "o"."value",
          "o"."maker"
        FROM "orders" "o"
        JOIN "token_sets_tokens" "tst" ON "o"."token_set_id" = "tst"."token_set_id"
        WHERE "tst"."contract" = "x"."contract"
        AND "tst"."token_id" = "x"."token_id"
        AND "o"."side" = 'buy'
        AND "o"."fillability_status" = 'fillable'
        AND "o"."approval_status" = 'approved'
        AND EXISTS(
          SELECT FROM "nft_balances" "nb"
            WHERE "nb"."contract" = "x"."contract"
            AND "nb"."token_id" = "x"."token_id"
            AND "nb"."amount" > 0
            AND "nb"."owner" != "o"."maker"
        )
        ORDER BY "o"."value" DESC
        LIMIT 1
      ) "y" ON TRUE
    `;
        const result = await db_1.redb.manyOrNone(query, values);
        return lodash_1.default.map(result, (r) => ({
            contract: r.contract ? (0, utils_1.fromBuffer)(r.contract) : null,
            tokenId: r.token_id,
            orderId: r.order_id,
            value: r.value,
            maker: r.maker ? (0, utils_1.fromBuffer)(r.maker) : null,
        }));
    }
    /**
     * Get top bid for the given token set
     * @param tokenSetId
     */
    static async getTokenSetTopBid(tokenSetId) {
        const query = `
      SELECT "x"."contract", "x"."token_id", "y"."order_id", "y"."value", "y"."maker"
      FROM (
        SELECT contract, token_id
        FROM token_sets_tokens
        WHERE token_set_id = $/tokenSetId/
        ORDER BY contract, token_id ASC
      ) "x" LEFT JOIN LATERAL (
        SELECT
          "o"."id" as "order_id",
          "o"."value",
          "o"."maker"
        FROM "orders" "o"
        JOIN "token_sets_tokens" "tst" ON "o"."token_set_id" = "tst"."token_set_id"
        WHERE "tst"."contract" = "x"."contract"
        AND "tst"."token_id" = "x"."token_id"
        AND "o"."side" = 'buy'
        AND "o"."fillability_status" = 'fillable'
        AND "o"."approval_status" = 'approved'
        AND EXISTS(
          SELECT FROM "nft_balances" "nb"
            WHERE "nb"."contract" = "x"."contract"
            AND "nb"."token_id" = "x"."token_id"
            AND "nb"."amount" > 0
            AND "nb"."owner" != "o"."maker"
        )
        ORDER BY "o"."value" DESC
        LIMIT 1
      ) "y" ON TRUE
    `;
        const result = await db_1.redb.manyOrNone(query, {
            tokenSetId,
        });
        return lodash_1.default.map(result, (r) => ({
            contract: (0, utils_1.fromBuffer)(r.contract),
            tokenId: r.token_id,
            orderId: r.order_id,
            value: r.value,
            maker: (0, utils_1.fromBuffer)(r.maker),
        }));
    }
}
exports.Tokens = Tokens;
//# sourceMappingURL=index.js.map