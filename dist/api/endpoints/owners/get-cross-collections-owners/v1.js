"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrossCollectionsOwnersV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const lodash_1 = __importDefault(require("lodash"));
const version = "v1";
exports.getCrossCollectionsOwnersV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 60 * 60 * 1000,
    },
    description: "Owners intersection",
    notes: "Find which addresses own the most of a group of collections.",
    tags: ["api", "Owners"],
    plugins: {
        "hapi-swagger": {
            order: 6,
        },
    },
    validate: {
        query: joi_1.default.object({
            collections: joi_1.default.alternatives()
                .try(joi_1.default.array()
                .items(joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/))
                .min(1)
                .max(5)
                .description("Filter to one or more collections. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"), joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to one or more collections. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"))
                .required(),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(50)
                .default(20)
                .description("Amount of owners returned in response."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            owners: joi_1.default.array().items(joi_1.default.object({
                address: joi_1.default.string(),
                count: joi_1.default.number(),
                collections: joi_1.default.array(),
            })),
        }).label(`getCrossCollectionsOwners${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-cross-collections-owners-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        let collectionsFilter = "";
        const query = request.query;
        if (query.collections) {
            if (!lodash_1.default.isArray(query.collections)) {
                query.collections = [query.collections];
            }
            for (const collection of query.collections) {
                const rawCollection = `'${lodash_1.default.replace(collection, "0x", "\\x")}'`;
                if (lodash_1.default.isUndefined(query.collectionsFilter)) {
                    query.collectionsFilter = [];
                }
                query.collectionsFilter.push(rawCollection);
            }
            query.collectionsFilter = lodash_1.default.join(query.collectionsFilter, ",");
            collectionsFilter = `contract IN ($/collectionsFilter:raw/)`;
        }
        try {
            const baseQuery = `
        WITH x AS (
          SELECT DISTINCT ON (owner, contract) owner, contract
          FROM nft_balances
          WHERE ${collectionsFilter}
          AND amount > 0
        )
        
        SELECT owner, array_agg(contract) AS "contracts", array_length(array_agg(contract), 1) AS "contract_count"
        FROM x
        GROUP BY x.owner
        ORDER BY contract_count DESC, owner ASC
        LIMIT ${query.limit}
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => ({
                address: (0, utils_1.fromBuffer)(r.owner),
                count: Number(r.contract_count),
                collections: lodash_1.default.map(r.contracts, (contract) => (0, utils_1.fromBuffer)(contract)),
            })));
            return { owners: result };
        }
        catch (error) {
            logger_1.logger.error(`get-cross-collections-owners-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map