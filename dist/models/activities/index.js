"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Activities = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const activities_entity_1 = require("@/models/activities/activities-entity");
class Activities {
    static async addActivities(activities) {
        if (!activities.length) {
            return;
        }
        const columns = new db_1.pgp.helpers.ColumnSet([
            "hash",
            "type",
            "contract",
            "collection_id",
            "token_id",
            "order_id",
            "from_address",
            "to_address",
            "price",
            "amount",
            "block_hash",
            "event_timestamp",
            "metadata",
        ], { table: "activities" });
        const data = activities.map((activity) => ({
            type: activity.type,
            hash: activity.hash,
            contract: (0, utils_1.toBuffer)(activity.contract),
            collection_id: activity.collectionId,
            token_id: activity.tokenId,
            order_id: activity.orderId,
            from_address: (0, utils_1.toBuffer)(activity.fromAddress),
            to_address: activity.toAddress ? (0, utils_1.toBuffer)(activity.toAddress) : null,
            price: activity.price,
            amount: activity.amount,
            block_hash: activity.blockHash ? (0, utils_1.toBuffer)(activity.blockHash) : null,
            event_timestamp: activity.eventTimestamp,
            metadata: activity.metadata,
        }));
        const query = db_1.pgp.helpers.insert(data, columns) + " ON CONFLICT DO NOTHING";
        await db_1.idb.none(query);
    }
    static async deleteByBlockHash(blockHash) {
        const query = `DELETE FROM activities
                   WHERE block_hash = $/blockHash/`;
        return await db_1.idb.none(query, { blockHash });
    }
    static async getActivities(continuation = null, limit = 20, byEventTimestamp = false) {
        let eventTimestamp;
        let id;
        let baseQuery = `
            SELECT *
            FROM activities
            LEFT JOIN LATERAL (
               SELECT 
                   source_id_int AS "order_source_id_int",
                   side AS "order_side",
                   kind AS "order_kind"
               FROM orders
               WHERE activities.order_id = orders.id
            ) o ON TRUE
            `;
        if (byEventTimestamp) {
            if (!lodash_1.default.isNull(continuation)) {
                [eventTimestamp, id] = (0, utils_1.splitContinuation)(continuation, /^(\d+)_(\d+)$/);
                baseQuery += ` WHERE (event_timestamp, id) < ($/eventTimestamp/, $/id/)`;
            }
            baseQuery += ` ORDER BY event_timestamp DESC, id DESC`;
        }
        else {
            if (!lodash_1.default.isNull(continuation)) {
                id = continuation;
                baseQuery += ` WHERE id > $/id/`;
            }
            baseQuery += ` ORDER BY id ASC`;
        }
        baseQuery += ` LIMIT $/limit/`;
        const activities = await db_1.idb.manyOrNone(baseQuery, {
            limit,
            id,
            eventTimestamp,
        });
        if (activities) {
            return lodash_1.default.map(activities, (activity) => new activities_entity_1.ActivitiesEntity(activity));
        }
        return [];
    }
    static async updateMissingCollectionId(contract, tokenId, collectionId) {
        const query = `
            UPDATE activities
            SET collection_id = $/collectionId/
            WHERE activities.contract = $/contract/
            AND activities.token_id = $/tokenId/
            AND activities.collection_id IS NULL
        `;
        return await db_1.idb.none(query, {
            contract: (0, utils_1.toBuffer)(contract),
            tokenId,
            collectionId,
        });
    }
    static async getCollectionActivities(collectionId = "", community = "", collectionsSetId = "", createdBefore = null, types = [], limit = 20, sortBy = "eventTimestamp", includeMetadata = true) {
        const sortByColumn = sortBy == "eventTimestamp" ? "event_timestamp" : "created_at";
        let continuation = "";
        let typesFilter = "";
        let metadataQuery = "";
        let collectionFilter = "";
        let joinCollectionsSet = "";
        let nullsLast = "";
        if (!lodash_1.default.isNull(createdBefore)) {
            continuation = `AND ${sortByColumn} < $/createdBefore/`;
        }
        if (!lodash_1.default.isEmpty(types)) {
            typesFilter = `AND type IN ('$/types:raw/')`;
        }
        if (collectionsSetId) {
            joinCollectionsSet =
                "JOIN collections_sets_collections csc ON activities.collection_id = csc.collection_id";
            collectionFilter = "WHERE csc.collections_set_id = $/collectionsSetId/";
        }
        else if (community) {
            collectionFilter =
                "WHERE collection_id IN (SELECT id FROM collections WHERE community = $/community/)";
        }
        else if (collectionId) {
            nullsLast = "NULLS LAST";
            collectionFilter = "WHERE collection_id = $/collectionId/";
        }
        if (!collectionFilter) {
            return [];
        }
        if (includeMetadata) {
            metadataQuery = `
             LEFT JOIN LATERAL (
                SELECT name AS "token_name", image AS "token_image"
                FROM tokens
                WHERE activities.contract = tokens.contract
                AND activities.token_id = tokens.token_id
             ) t ON TRUE
             LEFT JOIN LATERAL (
                SELECT name AS "collection_name", metadata AS "collection_metadata"
                FROM collections
                WHERE activities.collection_id = collections.id
             ) c ON TRUE
             LEFT JOIN LATERAL (
                SELECT 
                    source_id_int AS "order_source_id_int",
                    side AS "order_side",
                    kind AS "order_kind"
                FROM orders
                WHERE activities.order_id = orders.id
             ) o ON TRUE`;
        }
        const activities = await db_1.redb.manyOrNone(`SELECT *
             FROM activities
             ${joinCollectionsSet}
             ${metadataQuery}
             ${collectionFilter}
             ${continuation}
             ${typesFilter}
             ORDER BY activities.${sortByColumn} DESC ${nullsLast}
             LIMIT $/limit/`, {
            collectionId,
            limit,
            community,
            collectionsSetId,
            createdBefore: sortBy == "eventTimestamp" ? Number(createdBefore) : createdBefore,
            types: lodash_1.default.join(types, "','"),
        });
        if (activities) {
            return lodash_1.default.map(activities, (activity) => new activities_entity_1.ActivitiesEntity(activity));
        }
        return [];
    }
    static async getTokenActivities(contract, tokenId, createdBefore = null, types = [], limit = 20, sortBy = "eventTimestamp") {
        const sortByColumn = sortBy == "eventTimestamp" ? "event_timestamp" : "created_at";
        let continuation = "";
        let typesFilter = "";
        if (!lodash_1.default.isNull(createdBefore)) {
            continuation = `AND ${sortByColumn} < $/createdBefore/`;
        }
        if (!lodash_1.default.isEmpty(types)) {
            typesFilter = `AND type IN ('$/types:raw/')`;
        }
        const activities = await db_1.redb.manyOrNone(`SELECT *
             FROM activities
             LEFT JOIN LATERAL (
                SELECT name AS "token_name", image AS "token_image"
                FROM tokens
                WHERE activities.contract = tokens.contract
                AND activities.token_id = tokens.token_id
             ) t ON TRUE
             LEFT JOIN LATERAL (
                SELECT name AS "collection_name", metadata AS "collection_metadata"
                FROM collections
                WHERE activities.collection_id = collections.id
             ) c ON TRUE
             LEFT JOIN LATERAL (
                SELECT 
                    source_id_int AS "order_source_id_int",
                    side AS "order_side",
                    kind AS "order_kind"
                FROM orders
                WHERE activities.order_id = orders.id
             ) o ON TRUE
             WHERE contract = $/contract/
             AND token_id = $/tokenId/
             ${continuation}
             ${typesFilter}
             ORDER BY ${sortByColumn} DESC NULLS LAST
             LIMIT $/limit/`, {
            contract: (0, utils_1.toBuffer)(contract),
            tokenId,
            limit,
            createdBefore: sortBy == "eventTimestamp" ? Number(createdBefore) : createdBefore,
            types: lodash_1.default.join(types, "','"),
        });
        if (activities) {
            return lodash_1.default.map(activities, (activity) => new activities_entity_1.ActivitiesEntity(activity));
        }
        return [];
    }
}
exports.Activities = Activities;
//# sourceMappingURL=index.js.map