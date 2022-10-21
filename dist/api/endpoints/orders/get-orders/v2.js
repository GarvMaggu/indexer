"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrdersV2Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const version = "v2";
exports.getOrdersV2Options = {
    description: "Submit order batch",
    notes: "Access orders with various filters applied. If you need orders created by a single user, use the positions API instead.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            id: joi_1.default.string(),
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/)
                .description("Filter to a particular token, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            tokenSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular set, e.g. `contract:0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            offset: joi_1.default.number().integer().min(0).max(10000).default(0),
            limit: joi_1.default.number().integer().min(1).max(50).default(20),
        })
            .or("id", "token", "tokenSetId")
            .oxor("id", "token", "tokenSetId"),
    },
    response: {
        schema: joi_1.default.object({
            orders: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string().required(),
                kind: joi_1.default.string().required(),
                side: joi_1.default.string().valid("buy", "sell").required(),
                fillabilityStatus: joi_1.default.string().required(),
                approvalStatus: joi_1.default.string().required(),
                tokenSetId: joi_1.default.string().required(),
                tokenSetSchemaHash: joi_1.default.string().required(),
                maker: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/)
                    .required(),
                taker: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/)
                    .required(),
                price: joi_1.default.number().unsafe().required(),
                value: joi_1.default.number().unsafe().required(),
                validFrom: joi_1.default.number().required(),
                validUntil: joi_1.default.number().required(),
                source: joi_1.default.string().allow(null),
                feeBps: joi_1.default.number().allow(null),
                feeBreakdown: joi_1.default.array()
                    .items(joi_1.default.object({
                    kind: joi_1.default.string(),
                    recipient: joi_1.default.string()
                        .lowercase()
                        .pattern(/^0x[a-fA-F0-9]{40}$/)
                        .allow(null),
                    bps: joi_1.default.number(),
                }))
                    .allow(null),
                expiration: joi_1.default.number().required(),
                createdAt: joi_1.default.string().required(),
                updatedAt: joi_1.default.string().required(),
                rawData: joi_1.default.object(),
            })),
        }).label(`getOrders${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-orders-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT DISTINCT ON ("o"."id")
          "o"."id",
          "o"."kind",
          "o"."side",
          "o"."fillability_status",
          "o"."approval_status",
          "o"."token_set_id",
          "o"."token_set_schema_hash",
          "o"."maker",
          "o"."taker",
          "o"."price",
          "o"."value",
          DATE_PART('epoch', LOWER("o"."valid_between")) AS "valid_from",
          COALESCE(
            NULLIF(DATE_PART('epoch', UPPER("o"."valid_between")), 'Infinity'),
            0
          ) AS "valid_until",
          "o"."source_id_int",
          "o"."fee_bps",
          "o"."fee_breakdown",
          COALESCE(
            NULLIF(DATE_PART('epoch', "o"."expiration"), 'Infinity'),
            0
          ) AS "expiration",
          "o"."created_at",
          "o"."updated_at",
          "o"."raw_data"
        FROM "orders" "o"
      `;
            if (query.token) {
                baseQuery += `
          JOIN "token_sets_tokens" "tst"
            ON "o"."token_set_id" = "tst"."token_set_id"
        `;
            }
            // Filters
            const conditions = [
                `"o"."fillability_status" = 'fillable'`,
                `"o"."approval_status" = 'approved'`,
            ];
            if (query.id) {
                conditions.push(`"o"."id" = $/id/`);
            }
            if (query.token) {
                const [contract, tokenId] = query.token.split(":");
                query.contract = (0, utils_1.toBuffer)(contract);
                query.tokenId = tokenId;
                conditions.push(`"tst"."contract" = $/contract/`);
                conditions.push(`"tst"."token_id" = $/tokenId/`);
            }
            if (query.tokenSetId) {
                conditions.push(`"o"."token_set_id" = $/tokenSetId/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += ` ORDER BY "o"."id"`;
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            const sources = await sources_1.Sources.getInstance();
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => {
                var _a;
                return {
                    id: r.id,
                    kind: r.kind,
                    side: r.side,
                    fillabilityStatus: r.fillability_status,
                    approvalStatus: r.approval_status,
                    tokenSetId: r.token_set_id,
                    tokenSetSchemaHash: (0, utils_1.fromBuffer)(r.token_set_schema_hash),
                    maker: (0, utils_1.fromBuffer)(r.maker),
                    taker: (0, utils_1.fromBuffer)(r.taker),
                    price: (0, utils_1.formatEth)(r.price),
                    // For consistency, we set the value of "sell" orders as price - fee
                    value: r.side === "buy"
                        ? (0, utils_1.formatEth)(r.value)
                        : (0, utils_1.formatEth)(r.value) - ((0, utils_1.formatEth)(r.value) * Number(r.fee_bps)) / 10000,
                    validFrom: Number(r.valid_from),
                    validUntil: Number(r.valid_until),
                    source: (_a = sources.get(r.source_id_int)) === null || _a === void 0 ? void 0 : _a.name,
                    feeBps: Number(r.fee_bps),
                    feeBreakdown: r.fee_breakdown,
                    expiration: Number(r.expiration),
                    createdAt: new Date(r.created_at).toISOString(),
                    updatedAt: new Date(r.updated_at).toISOString(),
                    rawData: r.raw_data,
                };
            }));
            return { orders: result };
        }
        catch (error) {
            logger_1.logger.error(`get-orders-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map