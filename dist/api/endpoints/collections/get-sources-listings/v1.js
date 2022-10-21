"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSourcesListingsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const version = "v1";
exports.getSourcesListingsV1Options = {
    description: "Collection Source Stats",
    notes: "This API returns aggregated listings info for the given collection per source",
    tags: ["api", "Collections"],
    plugins: {
        "hapi-swagger": {
            order: 9,
        },
    },
    validate: {
        query: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .required()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            sources: joi_1.default.array().items(joi_1.default.object({
                onSaleCount: joi_1.default.number(),
                sourceDomain: joi_1.default.string().allow(null, ""),
                floorAskPrice: joi_1.default.number().unsafe().allow(null),
            })),
        }).label(`getSourcesListings${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-sources-listings-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            const baseQuery = `
        SELECT source_id_int, count(DISTINCT token_id) AS "on_sale_count", MIN(value) AS "floor_sell_value"
        FROM (
          SELECT contract, token_id
          FROM tokens
          WHERE collection_id = $/collection/
          AND floor_sell_value IS NOT NULL
        ) "x" JOIN LATERAL (
          SELECT orders.value, orders.source_id_int
          FROM orders
          JOIN token_sets_tokens ON orders.token_set_id = token_sets_tokens.token_set_id
          WHERE token_sets_tokens.contract = x.contract
          AND token_sets_tokens.token_id = x.token_id
          AND orders.side = 'sell'
          AND orders.fillability_status = 'fillable'
          AND orders.approval_status = 'approved'
        ) "y" ON TRUE
        GROUP BY source_id_int
        ORDER BY on_sale_count DESC
      `;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            const sources = await sources_1.Sources.getInstance();
            const result = await Promise.all(rawResult.map(async (r) => {
                var _a;
                return ({
                    sourceDomain: (_a = sources.get(r.source_id_int)) === null || _a === void 0 ? void 0 : _a.domain,
                    onSaleCount: Number(r.on_sale_count),
                    floorAskPrice: (0, utils_1.formatEth)(r.floor_sell_value),
                });
            }));
            return {
                sources: result,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-sources-listings-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map