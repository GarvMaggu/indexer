"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokensFloorV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getTokensFloorV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 5000,
    },
    description: "Token Prices",
    notes: "This API will return the best price of every token in a collection that is currently on sale",
    tags: ["api", "Tokens"],
    plugins: {
        "hapi-swagger": {
            order: 10,
        },
    },
    validate: {
        query: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        })
            .or("collection", "contract")
            .oxor("collection", "contract"),
    },
    response: {
        schema: joi_1.default.object({
            tokens: joi_1.default.object().pattern(/^[0-9]+$/, joi_1.default.number().unsafe()),
        }).label(`getTokensFloor${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-tokens-floor-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          "t"."token_id",
          "t"."floor_sell_value"
        FROM "tokens" "t"
      `;
            // Filters
            const conditions = [`"t"."floor_sell_value" IS NOT NULL`];
            if (query.collection) {
                conditions.push(`"t"."collection_id" = $/collection/`);
            }
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`"t"."contract" = $/contract/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            const result = await db_1.redb
                .manyOrNone(baseQuery, query)
                .then((result) => Object.fromEntries(result.map((r) => [r.token_id, (0, utils_1.formatEth)(r.floor_sell_value)])));
            return { tokens: result };
        }
        catch (error) {
            logger_1.logger.error(`get-tokens-floor-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map