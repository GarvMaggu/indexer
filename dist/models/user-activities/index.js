"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivities = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const user_activities_entity_1 = require("@/models/user-activities/user-activities-entity");
class UserActivities {
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
            "address",
            "from_address",
            "to_address",
            "price",
            "amount",
            "block_hash",
            "event_timestamp",
            "metadata",
        ], { table: "user_activities" });
        const data = activities.map((activity) => ({
            type: activity.type,
            hash: activity.hash,
            contract: (0, utils_1.toBuffer)(activity.contract),
            collection_id: activity.collectionId,
            token_id: activity.tokenId,
            order_id: activity.orderId,
            address: (0, utils_1.toBuffer)(activity.address),
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
    static async getActivities(users, collections = [], community = "", createdBefore = null, types = [], limit = 20, sortBy = "eventTimestamp") {
        const sortByColumn = sortBy == "eventTimestamp" ? "event_timestamp" : "created_at";
        let continuation = "";
        let typesFilter = "";
        let collectionFilter = "";
        let communityFilter = "";
        if (!lodash_1.default.isNull(createdBefore)) {
            continuation = `AND ${sortByColumn} < $/createdBefore/`;
        }
        if (!lodash_1.default.isEmpty(types)) {
            typesFilter = `AND type IN ('$/types:raw/')`;
        }
        if (!lodash_1.default.isEmpty(collections)) {
            if (Array.isArray(collections)) {
                collectionFilter = `AND collections.id IN ($/collections:csv/)`;
            }
            else {
                collectionFilter = `AND collections.id = $/collections/`;
            }
        }
        if (community) {
            communityFilter = "AND collections.community = $/community/";
        }
        const values = {
            limit,
            createdBefore: sortBy == "eventTimestamp" ? Number(createdBefore) : createdBefore,
            types: lodash_1.default.join(types, "','"),
            collections,
            community,
        };
        let usersFilter = "";
        let i = 0;
        const addUsersToFilter = (user) => {
            ++i;
            values[`user${i}`] = (0, utils_1.toBuffer)(user);
            usersFilter = `${usersFilter}$/user${i}/, `;
        };
        users.forEach(addUsersToFilter);
        usersFilter = `address IN (${usersFilter.substring(0, usersFilter.lastIndexOf(", "))})`;
        const activities = await db_1.redb.manyOrNone(`SELECT *
             FROM user_activities
             LEFT JOIN LATERAL (
                SELECT name AS "token_name", image AS "token_image"
                FROM tokens
                WHERE user_activities.contract = tokens.contract
                AND user_activities.token_id = tokens.token_id
             ) t ON TRUE
             ${!lodash_1.default.isEmpty(collections) || community ? "" : "LEFT"} JOIN LATERAL (
                SELECT name AS "collection_name", metadata AS "collection_metadata"
                FROM collections
                WHERE user_activities.collection_id = collections.id
                ${collectionFilter}
                ${communityFilter}
             ) c ON TRUE
             LEFT JOIN LATERAL (
                SELECT 
                    source_id_int AS "order_source_id_int",
                    side AS "order_side",
                    kind AS "order_kind"
                FROM orders
                WHERE user_activities.order_id = orders.id
             ) o ON TRUE
             WHERE ${usersFilter}
             ${continuation}
             ${typesFilter}
             ORDER BY ${sortByColumn} DESC NULLS LAST
             LIMIT $/limit/`, values);
        if (activities) {
            return lodash_1.default.map(activities, (activity) => new user_activities_entity_1.UserActivitiesEntity(activity));
        }
        return [];
    }
    static async deleteByBlockHash(blockHash) {
        const query = `DELETE FROM user_activities
                   WHERE block_hash = $/blockHash/`;
        return await db_1.idb.none(query, { blockHash });
    }
    static async updateMissingCollectionId(contract, tokenId, collectionId) {
        const query = `
            UPDATE user_activities
            SET collection_id = $/collectionId/
            WHERE user_activities.contract = $/contract/
            AND user_activities.token_id = $/tokenId/
            AND user_activities.collection_id IS NULL
        `;
        return await db_1.idb.none(query, {
            contract: (0, utils_1.toBuffer)(contract),
            tokenId,
            collectionId,
        });
    }
}
exports.UserActivities = UserActivities;
//# sourceMappingURL=index.js.map