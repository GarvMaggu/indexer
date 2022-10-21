"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokensV4Options = void 0;
const sources_1 = require("@/models/sources");
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const assets_1 = require("@/utils/assets");
const version = "v4";
exports.getTokensV4Options = {
    description: "Tokens",
    notes: "This API is optimized for quickly fetching a list of tokens in a collection, sorted by price, with only the most important information returned. If you need more metadata, use the tokens/details API",
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
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            tokens: joi_1.default.alternatives().try(joi_1.default.array()
                .max(50)
                .items(joi_1.default.string().lowercase().pattern(utils_1.regex.token))
                .description("Array of tokens. Example: `tokens[0]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:704tokens[1]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:979`"), joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Array of tokens. Example: `tokens[0]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:704 tokens[1]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:979`")),
            tokenSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular token set. Example: token:0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270:129000685"),
            attributes: joi_1.default.object()
                .unknown()
                .description("Filter to a particular attribute. Example: `attributes[Type]=Original`"),
            source: joi_1.default.string().description("Domain of the order source. Example `opensea.io`"),
            native: joi_1.default.boolean().description("If true, results will filter only Reservoir orders."),
            sortBy: joi_1.default.string()
                .allow("floorAskPrice", "tokenId", "rarity")
                .when("contract", {
                is: joi_1.default.exist(),
                then: joi_1.default.invalid("floorAskPrice", "rarity"),
            })
                .default((parent) => (parent && parent.contract ? "tokenId" : "floorAskPrice"))
                .description("Order the items are returned in the response, by default sorted by `floorAskPrice`. Not supported when filtering by `contract`. When filtering by `contract` the results are sorted by `tokenId` by default."),
            sortDirection: joi_1.default.string().lowercase().valid("asc", "desc"),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(50)
                .default(20)
                .description("Amount of items returned in response."),
            includeTopBid: joi_1.default.boolean()
                .default(false)
                .description("If true, top bid will be returned in the response."),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
        })
            .or("collection", "contract", "tokens", "tokenSetId")
            .oxor("collection", "contract", "tokens", "tokenSetId")
            .with("attributes", "collection")
            .with("source", "collection")
            .with("native", "collection"),
    },
    response: {
        schema: joi_1.default.object({
            tokens: joi_1.default.array().items(joi_1.default.object({
                contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
                tokenId: joi_1.default.string().pattern(utils_1.regex.number).required(),
                name: joi_1.default.string().allow(null, ""),
                image: joi_1.default.string().allow(null, ""),
                media: joi_1.default.string().allow(null, ""),
                collection: joi_1.default.object({
                    id: joi_1.default.string().allow(null),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    slug: joi_1.default.string().allow(null, ""),
                }),
                source: joi_1.default.string().allow(null, ""),
                sourceDomain: joi_1.default.string().allow(null, ""),
                topBidValue: joi_1.default.number().unsafe().allow(null).optional(),
                floorAskPrice: joi_1.default.number().unsafe().allow(null),
                rarity: joi_1.default.number().unsafe().allow(null),
                rarityRank: joi_1.default.number().unsafe().allow(null),
                owner: joi_1.default.string().allow(null, ""),
                isFlagged: joi_1.default.boolean().default(false),
                lastFlagUpdate: joi_1.default.string().allow(null, ""),
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
        let selectTopBid = "";
        let topBidQuery = "";
        if (query.includeTopBid) {
            selectTopBid = "y.top_buy_value,";
            topBidQuery = `
        LEFT JOIN LATERAL (
          SELECT o.value AS "top_buy_value"
          FROM "orders" "o"
          JOIN "token_sets_tokens" "tst" ON "o"."token_set_id" = "tst"."token_set_id"
          WHERE "tst"."contract" = "t"."contract"
          AND "tst"."token_id" = "t"."token_id"
          AND "o"."side" = 'buy'
          AND "o"."fillability_status" = 'fillable'
          AND "o"."approval_status" = 'approved'
          AND EXISTS(
            SELECT FROM "nft_balances" "nb"
              WHERE "nb"."contract" = "t"."contract"
              AND "nb"."token_id" = "t"."token_id"
              AND "nb"."amount" > 0
              AND "nb"."owner" != "o"."maker"
          )
          ORDER BY "o"."value" DESC
          LIMIT 1
        ) "y" ON TRUE
      `;
        }
        try {
            let baseQuery = `
        SELECT
          "t"."contract",
          "t"."token_id",
          "t"."name",
          "t"."image",
          "t"."media",
          "t"."collection_id",
          "c"."name" as "collection_name",
          "t"."floor_sell_source_id_int",
          ("c".metadata ->> 'imageUrl')::TEXT AS "collection_image",
          "c"."slug",
          "t"."floor_sell_value",
          ${selectTopBid}
          "t"."rarity_score",
          "t"."rarity_rank",
          "t"."is_flagged",
          "t"."last_flag_update",
          (
            SELECT owner
            FROM "nft_balances" "nb"
            WHERE nb.contract = "t"."contract"
            AND nb.token_id = "t"."token_id"
            AND nb.amount > 0
            LIMIT 1
          ) AS "owner"
        FROM "tokens" "t"
        ${topBidQuery}
        JOIN "collections" "c" ON "t"."collection_id" = "c"."id"
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
                Object.entries(query.attributes).forEach(([key, value]) => attributes.push({ key, value }));
                for (let i = 0; i < attributes.length; i++) {
                    const multipleSelection = Array.isArray(attributes[i].value);
                    query[`key${i}`] = attributes[i].key;
                    query[`value${i}`] = attributes[i].value;
                    baseQuery += `
            JOIN "token_attributes" "ta${i}"
              ON "t"."contract" = "ta${i}"."contract"
              AND "t"."token_id" = "ta${i}"."token_id"
              AND "ta${i}"."key" = $/key${i}/
              AND "ta${i}"."value" ${multipleSelection ? `IN ($/value${i}:csv/)` : `= $/value${i}/`}
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
            if (query.source) {
                const sources = await sources_1.Sources.getInstance();
                let source = sources.getByName(query.source, false);
                if (!source) {
                    source = sources.getByDomain(query.source);
                }
                query.source = source === null || source === void 0 ? void 0 : source.id;
                conditions.push(`"t"."floor_sell_source_id_int" = $/source/`);
            }
            if (query.native) {
                conditions.push(`"t"."floor_sell_is_reservoir"`);
            }
            // Continue with the next page, this depends on the sorting used
            if (query.continuation && !query.tokens) {
                const contArr = (0, utils_1.splitContinuation)(query.continuation, /^((([0-9]+\.?[0-9]*|\.[0-9]+)|null|0x[a-fA-F0-9]+)_\d+|\d+)$/);
                if (query.collection || query.attributes || query.tokenSetId) {
                    if (contArr.length !== 2) {
                        logger_1.logger.error("get-tokens", JSON.stringify({
                            msg: "Invalid continuation string used",
                            params: request.query,
                        }));
                        throw new Error("Invalid continuation string used");
                    }
                    switch (query.sortBy) {
                        case "rarity": {
                            const sign = query.sortDirection == "desc" ? "<" : ">";
                            conditions.push(`("t"."rarity_score", "t"."token_id") ${sign} ($/contRarity/, $/contTokenId/)`);
                            query.contRarity = contArr[0];
                            query.contTokenId = contArr[1];
                            break;
                        }
                        case "tokenId": {
                            const sign = query.sortDirection == "desc" ? "<" : ">";
                            conditions.push(`("t"."contract", "t"."token_id") ${sign} ($/contContract/, $/contTokenId/)`);
                            query.contContract = (0, utils_1.toBuffer)(contArr[0]);
                            query.contTokenId = contArr[1];
                            break;
                        }
                        case "floorAskPrice":
                        default: {
                            const sign = query.sortDirection == "desc" ? "<" : ">";
                            if (contArr[0] !== "null") {
                                conditions.push(`(
                  (t.floor_sell_value, "t"."token_id") ${sign} ($/floorSellValue/, $/tokenId/)
                  OR (t.floor_sell_value is null)
                )
                `);
                                query.floorSellValue = contArr[0];
                                query.tokenId = contArr[1];
                            }
                            else {
                                conditions.push(`(t.floor_sell_value is null AND t.token_id ${sign} $/tokenId/)`);
                                query.tokenId = contArr[1];
                            }
                            break;
                        }
                    }
                }
                else {
                    const sign = query.sortDirection == "desc" ? "<" : ">";
                    conditions.push(`"t"."token_id" ${sign} $/tokenId/`);
                    query.tokenId = contArr[1] ? contArr[1] : contArr[0];
                }
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            // Only allow sorting on floorSell / tokenId / rarity when we filter by collection or attributes
            if (query.collection || query.attributes || query.tokenSetId) {
                switch (query.sortBy) {
                    case "rarity": {
                        baseQuery += ` ORDER BY "t"."rarity_score" ${query.sortDirection || "DESC"} NULLS LAST, "t"."token_id" ${query.sortDirection || "DESC"}`;
                        break;
                    }
                    case "tokenId": {
                        baseQuery += ` ORDER BY "t"."contract", "t"."token_id" ${query.sortDirection || "ASC"}`;
                        break;
                    }
                    case "floorAskPrice":
                    default: {
                        baseQuery += ` ORDER BY "t"."floor_sell_value" ${query.sortDirection || "ASC"} NULLS LAST, "t"."token_id"`;
                        break;
                    }
                }
            }
            else if (query.contract) {
                baseQuery += ` ORDER BY "t"."token_id" ${query.sortDirection || "ASC"}`;
            }
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            /** Depending on how we sorted, we use that sorting key to determine the next page of results
                Possible formats:
                  rarity_tokenid
                  contract_tokenid
                  floorAskPrice_tokenid
                  tokenid
             **/
            let continuation = null;
            if (rawResult.length === query.limit) {
                continuation = "";
                // Only build a "value_tokenid" continuation string when we filter on collection or attributes
                // Otherwise continuation string will just be based on the last tokenId. This is because only use sorting
                // when we have collection/attributes
                if (query.collection || query.attributes || query.tokenSetId) {
                    switch (query.sortBy) {
                        case "rarity":
                            continuation = rawResult[rawResult.length - 1].rarity_score || "null";
                            break;
                        case "tokenId":
                            continuation = (0, utils_1.fromBuffer)(rawResult[rawResult.length - 1].contract);
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
            const sources = await sources_1.Sources.getInstance();
            const result = rawResult.map((r) => {
                var _a, _b;
                return {
                    contract: (0, utils_1.fromBuffer)(r.contract),
                    tokenId: r.token_id,
                    name: r.name,
                    image: assets_1.Assets.getLocalAssetsLink(r.image),
                    media: r.media,
                    collection: {
                        id: r.collection_id,
                        name: r.collection_name,
                        image: assets_1.Assets.getLocalAssetsLink(r.collection_image),
                        slug: r.slug,
                    },
                    source: r.floor_sell_value
                        ? (_a = sources.get(Number(r.floor_sell_source_id_int))) === null || _a === void 0 ? void 0 : _a.name
                        : undefined,
                    sourceDomain: r.floor_sell_value
                        ? (_b = sources.get(Number(r.floor_sell_source_id_int))) === null || _b === void 0 ? void 0 : _b.domain
                        : undefined,
                    floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                    topBidValue: query.includeTopBid
                        ? r.top_buy_value
                            ? (0, utils_1.formatEth)(r.top_buy_value)
                            : null
                        : undefined,
                    rarity: r.rarity_score,
                    rarityRank: r.rarity_rank,
                    owner: r.owner ? (0, utils_1.fromBuffer)(r.owner) : null,
                    isFlagged: Boolean(Number(r.is_flagged)),
                    lastFlagUpdate: r.last_flag_update ? new Date(r.last_flag_update).toISOString() : null,
                };
            });
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
//# sourceMappingURL=v4.js.map