"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionsSetOwnersDistributionV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const collection_sets_1 = require("@/models/collection-sets");
const version = "v1";
exports.getCollectionsSetOwnersDistributionV1Options = {
    description: "Owners Collection Set Distribution",
    notes: "This API can be used to show what the distribution of owners in a collections set looks like.",
    tags: ["api", "Owners"],
    plugins: {
        "hapi-swagger": {
            order: 6,
        },
    },
    validate: {
        params: joi_1.default.object({
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .required()
                .description("Filter to a particular collections set."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            ownersDistribution: joi_1.default.array().items(joi_1.default.object({
                tokenCount: joi_1.default.number().unsafe(),
                ownerCount: joi_1.default.number().unsafe(),
            })),
        }).label(`getCollectionsSetOwnersDistribution${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collections-set-owners-distribution-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        try {
            let collectionFilter = "";
            let i = 0;
            const addCollectionToFilter = (id) => {
                ++i;
                params[`contract${i}`] = (0, utils_1.toBuffer)(id);
                collectionFilter = `${collectionFilter}$/contract${i}/, `;
            };
            await collection_sets_1.CollectionSets.getCollectionsIds(params.collectionsSetId).then((result) => result.forEach(addCollectionToFilter));
            if (!collectionFilter) {
                return { ownersDistribution: [] };
            }
            collectionFilter = `nft_balances.contract IN (${collectionFilter.substring(0, collectionFilter.lastIndexOf(", "))})`;
            const baseQuery = `
        WITH owners AS (
          SELECT nft_balances.owner, SUM(nft_balances.amount) AS token_count
          FROM nft_balances
          WHERE ${collectionFilter} AND nft_balances.amount > 0
          GROUP BY nft_balances.owner
        )
        
        SELECT owners.token_count, COUNT(*) AS owner_count
        FROM owners
        GROUP BY owners.token_count
        ORDER BY owners.token_count
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, params).then((result) => result.map((r) => ({
                tokenCount: Number(r.token_count),
                ownerCount: Number(r.owner_count),
            })));
            return { ownersDistribution: result };
        }
        catch (error) {
            logger_1.logger.error(`get-collections-set-owners-distribution-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map