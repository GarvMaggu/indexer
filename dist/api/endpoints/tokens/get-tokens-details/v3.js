"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokensDetailsV3Options = void 0;
const constants_1 = require("@ethersproject/constants");
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const sources_1 = require("@/models/sources");
const assets_1 = require("@/utils/assets");
const version = "v3";
exports.getTokensDetailsV3Options = {
    cache: {
        privacy: "public",
        expiresIn: 60000,
    },
    description: "Get one or more tokens with full details",
    notes: "Get a list of tokens with full metadata. This is useful for showing a single token page, or scenarios that require more metadata. If you don't need this metadata, you should use the <a href='#/tokens/getTokensV1'>tokens</a> API, which is much faster.",
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
            source: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular source, e.g. `0x5b3256965e7c3cf26e11fcaf296dfc8807c01073`"),
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
                token: joi_1.default.object({
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
                    tokenId: joi_1.default.string().pattern(utils_1.regex.number).required(),
                    name: joi_1.default.string().allow(null, ""),
                    description: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    kind: joi_1.default.string().allow(null, ""),
                    collection: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        name: joi_1.default.string().allow(null, ""),
                        image: joi_1.default.string().allow(null, ""),
                        slug: joi_1.default.string().allow(null, ""),
                    }),
                    lastBuy: {
                        value: joi_1.default.number().unsafe().allow(null),
                        timestamp: joi_1.default.number().unsafe().allow(null),
                    },
                    lastSell: {
                        value: joi_1.default.number().unsafe().allow(null),
                        timestamp: joi_1.default.number().unsafe().allow(null),
                    },
                    owner: joi_1.default.string().allow(null),
                    attributes: joi_1.default.array().items(joi_1.default.object({
                        key: joi_1.default.string(),
                        value: joi_1.default.string(),
                    })),
                }),
                market: joi_1.default.object({
                    floorAsk: {
                        id: joi_1.default.string().allow(null),
                        price: joi_1.default.number().unsafe().allow(null),
                        maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                        validFrom: joi_1.default.number().unsafe().allow(null),
                        validUntil: joi_1.default.number().unsafe().allow(null),
                        source: joi_1.default.object().allow(null),
                    },
                    topBid: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        value: joi_1.default.number().unsafe().allow(null),
                        maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).allow(null),
                        validFrom: joi_1.default.number().unsafe().allow(null),
                        validUntil: joi_1.default.number().unsafe().allow(null),
                    }),
                }),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getTokensDetails${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-tokens-details-${version}-handler`, `Wrong response schema: ${error}`);
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
          "t"."description",
          "t"."image",
          "t"."collection_id",
          "c"."name" as "collection_name",
          "con"."kind",
          ("c".metadata ->> 'imageUrl')::TEXT AS "collection_image",
          "c"."slug",
          "t"."last_buy_value",
          "t"."last_buy_timestamp",
          "t"."last_sell_value",
          "t"."last_sell_timestamp",
          (
            SELECT "nb"."owner" FROM "nft_balances" "nb"
            WHERE "nb"."contract" = "t"."contract"
              AND "nb"."token_id" = "t"."token_id"
              AND "nb"."amount" > 0
            LIMIT 1
          ) AS "owner",
          (
            SELECT
              array_agg(json_build_object('key', "ta"."key", 'value', "ta"."value"))
            FROM "token_attributes" "ta"
            WHERE "ta"."contract" = "t"."contract"
              AND "ta"."token_id" = "t"."token_id"
          ) AS "attributes",
          "t"."floor_sell_id",
          "t"."floor_sell_value",
          "t"."floor_sell_maker",
          DATE_PART('epoch', LOWER("os"."valid_between")) AS "floor_sell_valid_from",
          COALESCE(
            NULLIF(date_part('epoch', UPPER("os"."valid_between")), 'Infinity'),
            0
          ) AS "floor_sell_valid_until",
          "os"."source_id_int" AS "floor_sell_source_id_int",
          "t"."top_buy_id",
          "t"."top_buy_value",
          "t"."top_buy_maker",
          DATE_PART('epoch', LOWER("ob"."valid_between")) AS "top_buy_valid_from",
          COALESCE(
            NULLIF(DATE_PART('epoch', UPPER("ob"."valid_between")), 'Infinity'),
            0
          ) AS "top_buy_valid_until"
        FROM "tokens" "t"
        LEFT JOIN "orders" "os"
          ON "t"."floor_sell_id" = "os"."id"
        LEFT JOIN "orders" "ob"
          ON "t"."top_buy_id" = "ob"."id"
        JOIN "collections" "c"
          ON "t"."collection_id" = "c"."id"
        JOIN "contracts" "con"
          ON "t"."contract" = "con"."address"
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
            if (query.source) {
                if (query.source === constants_1.AddressZero) {
                    conditions.push(`"t"."floor_sell_value" IS NOT NULL AND coalesce("os"."source_id", '\\x00') = '\\x00'`);
                }
                else {
                    query.source = (0, utils_1.toBuffer)(query.source);
                    conditions.push(`"t"."floor_sell_value" IS NOT NULL AND coalesce("os"."source_id", '\\x00') = $/source/`);
                }
            }
            // Continue with the next page, this depends on the sorting used
            if (query.continuation && !query.token) {
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
            const sources = await sources_1.Sources.getInstance();
            const result = rawResult.map((r) => {
                const contract = (0, utils_1.fromBuffer)(r.contract);
                const tokenId = r.token_id;
                const source = r.floor_sell_source_id_int !== null
                    ? sources.get(r.floor_sell_source_id_int, contract, tokenId)
                    : undefined;
                return {
                    token: {
                        contract,
                        tokenId,
                        name: r.name,
                        description: r.description,
                        image: assets_1.Assets.getLocalAssetsLink(r.image),
                        kind: r.kind,
                        collection: {
                            id: r.collection_id,
                            name: r.collection_name,
                            image: assets_1.Assets.getLocalAssetsLink(r.collection_image),
                            slug: r.slug,
                        },
                        lastBuy: {
                            value: r.last_buy_value ? (0, utils_1.formatEth)(r.last_buy_value) : null,
                            timestamp: r.last_buy_timestamp,
                        },
                        lastSell: {
                            value: r.last_sell_value ? (0, utils_1.formatEth)(r.last_sell_value) : null,
                            timestamp: r.last_sell_timestamp,
                        },
                        owner: r.owner ? (0, utils_1.fromBuffer)(r.owner) : null,
                        attributes: r.attributes || [],
                    },
                    market: {
                        floorAsk: {
                            id: r.floor_sell_id,
                            price: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                            maker: r.floor_sell_maker ? (0, utils_1.fromBuffer)(r.floor_sell_maker) : null,
                            validFrom: r.floor_sell_valid_from,
                            validUntil: r.floor_sell_value ? r.floor_sell_valid_until : null,
                            source: {
                                id: source === null || source === void 0 ? void 0 : source.address,
                                name: (source === null || source === void 0 ? void 0 : source.metadata.title) || (source === null || source === void 0 ? void 0 : source.name),
                                icon: source === null || source === void 0 ? void 0 : source.metadata.icon,
                                url: source === null || source === void 0 ? void 0 : source.metadata.url,
                            },
                        },
                        topBid: {
                            id: r.top_buy_id,
                            value: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                            maker: r.top_buy_maker ? (0, utils_1.fromBuffer)(r.top_buy_maker) : null,
                            validFrom: r.top_buy_valid_from,
                            validUntil: r.top_buy_value ? r.top_buy_valid_until : null,
                        },
                    },
                };
            });
            return {
                tokens: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-tokens-details-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v3.js.map