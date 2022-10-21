"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokensV3Options = void 0;
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v3";
exports.getTokensV3Options = {
    description: "List of tokens, with basic details, optimized for speed",
    notes: "This API is optimized for quickly fetching a list of tokens in a collection, sorted by price, with only the most important information returned. If you need more metadata, use the `tokens/details` API",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular contract, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            tokens: joi_1.default.alternatives().try(joi_1.default.array()
                .max(50)
                .items(joi_1.default.string().lowercase().pattern(utils_1.regex.token))
                .description("Filter to one or more tokens, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"), joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Filter to one or more tokens, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`")),
            tokenSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular set, e.g. `contract:0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            attributes: joi_1.default.object()
                .unknown()
                .description("Filter to a particular attribute, e.g. `attributes[Type]=Original`"),
            sortBy: joi_1.default.string().valid("floorAskPrice", "topBidValue").default("floorAskPrice"),
            limit: joi_1.default.number().integer().min(1).max(50).default(20),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64),
        })
            .or("collection", "contract", "tokens", "tokenSetId")
            .oxor("collection", "contract", "tokens", "tokenSetId")
            .with("attributes", "collection"),
    },
    response: {
        schema: joi_1.default.object({
            tokens: joi_1.default.array().items(joi_1.default.object({
                contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
                tokenId: joi_1.default.string().pattern(utils_1.regex.number).required(),
                name: joi_1.default.string().allow(null, ""),
                image: joi_1.default.string().allow(null, ""),
                collection: joi_1.default.object({
                    id: joi_1.default.string().allow(null),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    slug: joi_1.default.string().allow(null, ""),
                }),
                topBidValue: joi_1.default.number().unsafe().allow(null),
                floorAskPrice: joi_1.default.number().unsafe().allow(null),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getTokens${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-tokens-${version}-handler`, `Wrong response schema: ${error}`);
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
          "t"."name",
          "t"."image",
          "t"."collection_id",
          "c"."name" as "collection_name",
          ("c".metadata ->> 'imageUrl')::TEXT AS "collection_image",
          "c"."slug",
          "t"."floor_sell_value",
          "t"."top_buy_value"
        FROM "tokens" "t"
        JOIN "collections" "c"
          ON "t"."collection_id" = "c"."id"
      `;
            if (query.tokenSetId) {
                baseQuery += `
          JOIN "token_sets_tokens" "tst"
            ON "t"."contract" = "tst"."contract"
            AND "t"."token_id" = "tst"."token_id"
        `;
            }
            if (query.attributes) {
                const attributes = [];
                Object.entries(query.attributes).forEach(([key, values]) => {
                    (Array.isArray(values) ? values : [values]).forEach((value) => attributes.push({ key, value }));
                });
                for (let i = 0; i < attributes.length; i++) {
                    query[`key${i}`] = attributes[i].key;
                    query[`value${i}`] = attributes[i].value;
                    baseQuery += `
            JOIN "token_attributes" "ta${i}"
              ON "t"."contract" = "ta${i}"."contract"
              AND "t"."token_id" = "ta${i}"."token_id"
              AND "ta${i}"."key" = $/key${i}/
              AND "ta${i}"."value" = $/value${i}/
          `;
                }
            }
            // Filters
            const conditions = [];
            if (query.collection) {
                conditions.push(`"t"."collection_id" = $/collection/`);
            }
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`"t"."contract" = $/contract/`);
            }
            if (query.tokens) {
                if (!lodash_1.default.isArray(query.tokens)) {
                    query.tokens = [query.tokens];
                }
                for (const token of query.tokens) {
                    const [contract, tokenId] = token.split(":");
                    const tokensFilter = `('${lodash_1.default.replace(contract, "0x", "\\x")}', '${tokenId}')`;
                    if (lodash_1.default.isUndefined(query.tokensFilter)) {
                        query.tokensFilter = [];
                    }
                    query.tokensFilter.push(tokensFilter);
                }
                query.tokensFilter = lodash_1.default.join(query.tokensFilter, ",");
                conditions.push(`("t"."contract", "t"."token_id") IN ($/tokensFilter:raw/)`);
            }
            if (query.tokenSetId) {
                conditions.push(`"tst"."token_set_id" = $/tokenSetId/`);
            }
            // Continue with the next page, this depends on the sorting used
            if (query.continuation && !query.tokens) {
                const contArr = (0, utils_1.splitContinuation)(query.continuation, /^((\d+|null)_\d+|\d+)$/);
                if (query.collection || query.attributes) {
                    if (contArr.length !== 2) {
                        logger_1.logger.error("get-tokens", JSON.stringify({
                            msg: "Invalid continuation string used",
                            params: request.query,
                        }));
                        throw new Error("Invalid continuation string used");
                    }
                    switch (query.sortBy) {
                        case "topBidValue":
                            if (contArr[0] !== "null") {
                                conditions.push(`
                  ("t"."top_buy_value", "t"."token_id") < ($/topBuyValue:raw/, $/tokenId:raw/)
                  OR (t.top_buy_value is null)
                 `);
                                query.topBuyValue = contArr[0];
                                query.tokenId = contArr[1];
                            }
                            else {
                                conditions.push(`(t.top_buy_value is null AND t.token_id < $/tokenId/)`);
                                query.tokenId = contArr[1];
                            }
                            break;
                        case "floorAskPrice":
                        default:
                            if (contArr[0] !== "null") {
                                conditions.push(`(
                  (t.floor_sell_value, "t"."token_id") > ($/floorSellValue/, $/tokenId/)
                  OR (t.floor_sell_value is null)
                )
                `);
                                query.floorSellValue = contArr[0];
                                query.tokenId = contArr[1];
                            }
                            else {
                                conditions.push(`(t.floor_sell_value is null AND t.token_id > $/tokenId/)`);
                                query.tokenId = contArr[1];
                            }
                            break;
                    }
                }
                else {
                    conditions.push(`"t"."token_id" > $/tokenId/`);
                    query.tokenId = contArr[1] ? contArr[1] : contArr[0];
                }
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            // Only allow sorting on floorSell and topBid when we filter by collection or attributes
            if (query.collection || query.attributes) {
                switch (query.sortBy) {
                    case "topBidValue": {
                        baseQuery += ` ORDER BY "t"."top_buy_value" DESC NULLS LAST, "t"."token_id" DESC`;
                        break;
                    }
                    case "floorAskPrice":
                    default: {
                        baseQuery += ` ORDER BY "t"."floor_sell_value" ASC NULLS LAST, "t"."token_id"`;
                        break;
                    }
                }
            }
            else if (query.contract) {
                baseQuery += ` ORDER BY "t"."token_id" ASC`;
            }
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            /** Depending on how we sorted, we use that sorting key to determine the next page of results
                Possible formats:
                  topBidValue_tokenid
                  floorAskPrice_tokenid
                  tokenid
             **/
            let continuation = null;
            if (rawResult.length === query.limit) {
                continuation = "";
                // Only build a "value_tokenid" continuation string when we filter on collection or attributes
                // Otherwise continuation string will just be based on the last tokenId. This is because only use sorting
                // when we have collection/attributes
                if (query.collection || query.attributes) {
                    switch (query.sortBy) {
                        case "topBidValue":
                            continuation = rawResult[rawResult.length - 1].top_buy_value || "null";
                            break;
                        case "floorAskPrice":
                            continuation = rawResult[rawResult.length - 1].floor_sell_value || "null";
                            break;
                        default:
                            break;
                    }
                    continuation += "_" + rawResult[rawResult.length - 1].token_id;
                }
                else {
                    continuation = rawResult[rawResult.length - 1].token_id;
                }
                continuation = (0, utils_1.buildContinuation)(continuation);
            }
            const result = rawResult.map((r) => ({
                contract: (0, utils_1.fromBuffer)(r.contract),
                tokenId: r.token_id,
                name: r.name,
                image: r.image,
                collection: {
                    id: r.collection_id,
                    name: r.collection_name,
                    image: r.collection_image,
                    slug: r.slug,
                },
                floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                topBidValue: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
            }));
            return {
                tokens: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-tokens-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v3.js.map