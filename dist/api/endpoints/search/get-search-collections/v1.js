"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchCollectionsV1Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const collection_sets_1 = require("@/models/collection-sets");
const assets_1 = require("@/utils/assets");
const version = "v1";
exports.getSearchCollectionsV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 10000,
    },
    description: "Search collections",
    tags: ["api", "Collections"],
    plugins: {
        "hapi-swagger": {
            order: 3,
        },
    },
    validate: {
        query: joi_1.default.object({
            name: joi_1.default.string()
                .lowercase()
                .description("Lightweight search for collections that match a string. Example: `bored`"),
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community. Example: `artblocks`"),
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection set"),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(50)
                .default(20)
                .description("Amount of items returned in response."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            collections: joi_1.default.array().items(joi_1.default.object({
                collectionId: joi_1.default.string(),
                contract: joi_1.default.string(),
                image: joi_1.default.string().allow(null, ""),
                name: joi_1.default.string().allow(null, ""),
                allTimeVolume: joi_1.default.number().unsafe().allow(null),
                floorAskPrice: joi_1.default.number().unsafe().allow(null),
                openseaVerificationStatus: joi_1.default.string().allow(null, ""),
            })),
        }).label(`getSearchCollections${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-search-collections-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        let whereClause = "";
        const conditions = [`token_count > 0`];
        if (query.name) {
            query.name = `%${query.name}%`;
            conditions.push(`name ILIKE $/name/`);
        }
        if (query.community) {
            conditions.push(`collections.community = $/community/`);
        }
        if (query.collectionsSetId) {
            const collectionsIds = await collection_sets_1.CollectionSets.getCollectionsIds(query.collectionsSetId);
            if (!lodash_1.default.isEmpty(collectionsIds)) {
                query.collectionsIds = lodash_1.default.join(collectionsIds, "','");
                conditions.push(`collections.id IN ('$/collectionsIds:raw/')`);
            }
        }
        if (conditions.length) {
            whereClause = " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
        }
        const baseQuery = `
            SELECT id, name, contract, (metadata ->> 'imageUrl')::TEXT AS image, all_time_volume, floor_sell_value,
                   (metadata ->> 'safelistRequestStatus')::TEXT AS opensea_verification_status
            FROM collections
            ${whereClause}
            ORDER BY all_time_volume DESC
            OFFSET 0
            LIMIT $/limit/`;
        const collections = await db_1.redb.manyOrNone(baseQuery, query);
        return {
            collections: lodash_1.default.map(collections, (collection) => ({
                collectionId: collection.id,
                name: collection.name,
                contract: (0, utils_1.fromBuffer)(collection.contract),
                image: assets_1.Assets.getLocalAssetsLink(collection.image),
                allTimeVolume: collection.all_time_volume ? (0, utils_1.formatEth)(collection.all_time_volume) : null,
                floorAskPrice: collection.floor_sell_value ? (0, utils_1.formatEth)(collection.floor_sell_value) : null,
                openseaVerificationStatus: collection.opensea_verification_status,
            })),
        };
    },
};
//# sourceMappingURL=v1.js.map