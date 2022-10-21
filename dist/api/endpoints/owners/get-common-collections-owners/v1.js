"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommonCollectionsOwnersV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const lodash_1 = __importDefault(require("lodash"));
const version = "v1";
exports.getCommonCollectionsOwnersV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 60 * 60 * 1000,
    },
    description: "Common Collections",
    notes: "This API can be used to find top common collections among the given owners",
    tags: ["api", "Owners"],
    plugins: {
        "hapi-swagger": {
            order: 6,
        },
    },
    validate: {
        query: joi_1.default.object({
            owners: joi_1.default.alternatives()
                .try(joi_1.default.array()
                .items(joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/))
                .min(1)
                .max(50)
                .description("Array of owner addresses. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"), joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Array of owner addresses. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"))
                .required(),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(50)
                .default(20)
                .description("Amount of collections returned in response."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            collections: joi_1.default.array().items(joi_1.default.object({
                address: joi_1.default.string(),
                count: joi_1.default.number(),
                owners: joi_1.default.array(),
            })),
        }).label(`getCommonCollectionsOwners${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-common-collections-owners-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        let ownersFilter = "";
        const query = request.query;
        if (query.owners) {
            if (!lodash_1.default.isArray(query.owners)) {
                query.owners = [query.owners];
            }
            for (const owner of query.owners) {
                const rawOwner = `'${lodash_1.default.replace(owner, "0x", "\\x")}'`;
                if (lodash_1.default.isUndefined(query.ownersFilter)) {
                    query.ownersFilter = [];
                }
                query.ownersFilter.push(rawOwner);
            }
            query.ownersFilter = lodash_1.default.join(query.ownersFilter, ",");
            ownersFilter = `owner IN ($/ownersFilter:raw/)`;
        }
        try {
            const baseQuery = `
        WITH x AS (
          SELECT DISTINCT ON (owner, contract) owner, contract
          FROM nft_balances
          WHERE ${ownersFilter}
          AND amount > 0
        )
        
        SELECT contract, array_agg(owner) AS "owners", array_length(array_agg(owner), 1) AS "owner_count"
        FROM x
        GROUP BY x.contract
        ORDER BY owner_count DESC, contract ASC
        LIMIT ${query.limit}
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => ({
                address: (0, utils_1.fromBuffer)(r.contract),
                count: Number(r.owner_count),
                owners: lodash_1.default.map(r.owners, (owner) => (0, utils_1.fromBuffer)(owner)),
            })));
            return { collections: result };
        }
        catch (error) {
            logger_1.logger.error(`get-common-collections-owners-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map