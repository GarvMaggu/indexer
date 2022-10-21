"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokensIdsV4Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getTokensIdsV4Options = {
    description: "Token IDs",
    notes: "This API is optimized for quickly fetching a list of tokens ids in by collection, contract, token set id. ",
    tags: ["api", "Tokens"],
    plugins: {
        "hapi-swagger": {
            order: 9,
        },
    },
    validate: {
        query: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            tokenSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular token set. Example: token:0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270:129000685"),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(10000)
                .default(100)
                .description("Amount of items returned in response."),
            continuation: joi_1.default.number().description("Use continuation token to request next offset of items."),
        })
            .or("collection", "contract", "tokenSetId")
            .oxor("collection", "contract", "tokenSetId"),
    },
    response: {
        schema: joi_1.default.object({
            tokens: joi_1.default.array().items(joi_1.default.string().pattern(utils_1.regex.number)),
            continuation: joi_1.default.number().allow(null),
        }).label(`getTokensIds${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-tokens-ids-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          "t"."token_id"
        FROM "tokens" "t"
      `;
            // Filters
            const conditions = [];
            if (query.collection) {
                conditions.push(`"t"."collection_id" = $/collection/`);
            }
            else if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`"t"."contract" = $/contract/`);
            }
            else if (query.tokenSetId) {
                baseQuery += `
          JOIN "token_sets_tokens" "tst"
            ON "t"."contract" = "tst"."contract"
            AND "t"."token_id" = "tst"."token_id"
        `;
                conditions.push(`"tst"."token_set_id" = $/tokenSetId/`);
            }
            // Continue with the next page, this depends on the sorting used
            if (query.continuation) {
                conditions.push(`("t"."token_id") > ($/contTokenId/)`);
                query.contTokenId = query.continuation;
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += ` ORDER BY "t"."token_id"`;
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            let continuation = null;
            if (rawResult.length === query.limit) {
                continuation = rawResult[rawResult.length - 1].token_id;
            }
            const result = rawResult.map((r) => r.token_id);
            return {
                tokens: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-tokens-ids-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map