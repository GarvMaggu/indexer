"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionOwnersDistributionV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getCollectionOwnersDistributionV1Options = {
    description: "Owners Collection Distribution",
    notes: "This API can be used to show what the distribution of owners in a collection looks like.",
    tags: ["api", "Owners"],
    plugins: {
        "hapi-swagger": {
            order: 6,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .required()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            ownersDistribution: joi_1.default.array().items(joi_1.default.object({
                tokenCount: joi_1.default.number().unsafe(),
                ownerCount: joi_1.default.number().unsafe(),
            })),
        }).label(`getCollectionOwnersDistribution${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collection-owners-distribution-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        try {
            let collectionFilter = "";
            if (params.collection.match(/^0x[a-f0-9]{40}:\d+:\d+$/g)) {
                const [contract, startTokenId, endTokenId] = params.collection.split(":");
                params.contract = (0, utils_1.toBuffer)(contract);
                params.startTokenId = startTokenId;
                params.endTokenId = endTokenId;
                collectionFilter = `
          nft_balances.contract = $/contract/
          AND nft_balances.token_id >= $/startTokenId/
          AND nft_balances.token_id <= $/endTokenId/
        `;
            }
            else {
                params.contract = (0, utils_1.toBuffer)(params.collection);
                collectionFilter = `nft_balances.contract = $/contract/`;
            }
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
            logger_1.logger.error(`get-collection-owners-distribution-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map