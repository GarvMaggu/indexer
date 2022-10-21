"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionTopBidsV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getCollectionTopBidsV1Options = {
    description: "Bid Distribution",
    notes: "When users are placing collection or trait bids, this API can be used to show them where the bid is in the context of other bids, and how many tokens it will be the top bid for.",
    tags: ["api", "Orders"],
    plugins: {
        "hapi-swagger": {
            order: 5,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .required()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            topBids: joi_1.default.array().items(joi_1.default.object({
                value: joi_1.default.number().unsafe(),
                quantity: joi_1.default.number(),
            })),
        }).label(`getCollectionTopBids${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collection-top-bids-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        try {
            const baseQuery = `
        SELECT "y"."value", COUNT(*) AS "quantity"
        FROM (
          SELECT contract, token_id
          FROM tokens
          WHERE collection_id = $/collection/
          ORDER BY contract, token_id ASC
        ) "x" LEFT JOIN LATERAL (
          SELECT
            "o"."id" as "order_id",
            "o"."value",
            "o"."maker"
          FROM "orders" "o"
          JOIN "token_sets_tokens" "tst" ON "o"."token_set_id" = "tst"."token_set_id"
          WHERE "tst"."contract" = "x"."contract"
          AND "tst"."token_id" = "x"."token_id"
          AND "o"."side" = 'buy'
          AND "o"."fillability_status" = 'fillable'
          AND "o"."approval_status" = 'approved'
          AND EXISTS(
            SELECT FROM "nft_balances" "nb"
            WHERE "nb"."contract" = "x"."contract"
            AND "nb"."token_id" = "x"."token_id"
            AND "nb"."amount" > 0
            AND "nb"."owner" != "o"."maker"
          )
          ORDER BY "o"."value" DESC
          LIMIT 1
        ) "y" ON TRUE
        WHERE value IS NOT NULL
        GROUP BY y.value
        ORDER BY y.value DESC NULLS LAST
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, params).then((result) => result.map((r) => ({
                value: (0, utils_1.formatEth)(r.value),
                quantity: Number(r.quantity),
            })));
            return { topBids: result };
        }
        catch (error) {
            logger_1.logger.error(`get-collection-top-bids-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map