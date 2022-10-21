"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokensBootstrapV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const assets_1 = require("@/utils/assets");
const version = "v1";
exports.getTokensBootstrapV1Options = {
    description: "Token Events Bootstrap",
    notes: "Get the latest price event per token in a collection, so that you can listen to future events and keep track of prices",
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
                .pattern(utils_1.regex.address)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(500)
                .default(500)
                .description("Amount of items returned in response."),
        })
            .or("collection", "contract")
            .oxor("collection", "contract"),
    },
    response: {
        schema: joi_1.default.object({
            tokens: joi_1.default.array().items(joi_1.default.object({
                contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                tokenId: joi_1.default.string().pattern(utils_1.regex.number),
                image: joi_1.default.string().allow(null, ""),
                orderId: joi_1.default.string(),
                maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                validFrom: joi_1.default.number().unsafe(),
                validUntil: joi_1.default.number().unsafe(),
                price: joi_1.default.number().unsafe(),
                source: joi_1.default.string().allow(null, ""),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64),
        }).label(`getTokensBootstrap${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-tokens-bootstrap-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          "t"."contract",
          "t"."token_id",
          "t"."image",
          "t"."floor_sell_id",
          "t"."floor_sell_value",
          "t"."floor_sell_maker",
          "t"."floor_sell_source_id_int",
          "t"."floor_sell_valid_from",
          "t"."floor_sell_valid_to"
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
            if (query.continuation) {
                const [floorSellValue, tokenId] = (0, utils_1.splitContinuation)(query.continuation, /^\d+_\d+$/);
                query.continuationFloorSellValue = floorSellValue;
                query.continuationTokenId = tokenId;
                conditions.push(`
            ("t"."floor_sell_value", "t"."token_id") > ($/continuationFloorSellValue/, $/continuationTokenId/)
            OR ("t"."floor_sell_value" IS NULL)
          `);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += ` ORDER BY "t"."floor_sell_value", "t"."token_id"`;
            // Pagination
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            const sources = await sources_1.Sources.getInstance();
            const result = rawResult.map((r) => {
                var _a;
                return {
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    tokenId: r.token_id,
                    image: assets_1.Assets.getLocalAssetsLink(r.image),
                    orderId: r.floor_sell_id,
                    maker: (0, utils_1.fromBuffer)(r.floor_sell_maker),
                    price: (0, utils_1.formatEth)(r.floor_sell_value),
                    validFrom: Number(r.floor_sell_valid_from),
                    validUntil: Number(r.floor_sell_valid_to),
                    source: (_a = sources.get(r.floor_sell_source_id_int)) === null || _a === void 0 ? void 0 : _a.name,
                };
            });
            let continuation;
            if (rawResult.length && rawResult.length >= query.limit) {
                const lastResult = rawResult[rawResult.length - 1];
                continuation = (0, utils_1.buildContinuation)(`${lastResult.floor_sell_value}_${lastResult.token_id}`);
            }
            return { tokens: result, continuation };
        }
        catch (error) {
            logger_1.logger.error(`get-tokens-bootstrap-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map