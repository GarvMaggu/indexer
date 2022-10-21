"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserCollectionsV1Options = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getUserCollectionsV1Options = {
    description: "Get aggregate stats for a user, grouped by collection",
    notes: "Get aggregate stats for a user, grouped by collection. Useful for showing total portfolio information.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 31,
            deprecated: true,
        },
    },
    validate: {
        params: joi_1.default.object({
            user: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .required()
                .description("Wallet to see results for e.g. `0xf296178d553c8ec21a2fbd2c5dda8ca9ac905a00`"),
        }),
        query: joi_1.default.object({
            community: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular community, e.g. `artblocks`"),
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            offset: joi_1.default.number().integer().min(0).max(10000).default(0),
            limit: joi_1.default.number().integer().min(1).max(100).default(20),
        }),
    },
    response: {
        schema: joi_1.default.object({
            collections: joi_1.default.array().items(joi_1.default.object({
                collection: joi_1.default.object({
                    id: joi_1.default.string(),
                    name: joi_1.default.string().allow(null, ""),
                    metadata: joi_1.default.object({
                        imageUrl: joi_1.default.string().allow(null, ""),
                        discordUrl: joi_1.default.string().allow(null, ""),
                        description: joi_1.default.string().allow(null, ""),
                        externalUrl: joi_1.default.string().allow(null, ""),
                        bannerImageUrl: joi_1.default.string().allow(null, ""),
                        twitterUsername: joi_1.default.string().allow(null, ""),
                    }).allow(null),
                    floorAskPrice: joi_1.default.number().unsafe().allow(null),
                    topBidValue: joi_1.default.number().unsafe().allow(null),
                }),
                ownership: joi_1.default.object({
                    tokenCount: joi_1.default.string(),
                    onSaleCount: joi_1.default.string(),
                    liquidCount: joi_1.default.string(),
                }),
            })),
        }).label(`getUserCollections${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-user-collections-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const query = request.query;
        try {
            let baseQuery = `
        SELECT  collections.id,
                collections.name,
                collections.metadata,
                SUM(nft_balances.amount) AS token_count,
                MAX(tokens.top_buy_value) AS top_buy_value,
                MIN(tokens.floor_sell_value) AS floor_sell_value,
                SUM(CASE WHEN tokens.floor_sell_value IS NULL THEN 0 ELSE 1 END) AS on_sale_count,
                SUM(CASE WHEN tokens.top_buy_value IS NULL THEN 0 ELSE 1 END) AS liquid_count
        FROM nft_balances
        JOIN tokens ON nft_balances.contract = tokens.contract AND nft_balances.token_id = tokens.token_id
        JOIN collections ON tokens.collection_id = collections.id
      `;
            // Filters
            params.user = (0, utils_1.toBuffer)(params.user);
            const conditions = [`nft_balances.owner = $/user/`, `nft_balances.amount > 0`];
            if (query.community) {
                conditions.push(`collections.community = $/community/`);
            }
            if (query.collection) {
                conditions.push(`collections.id = $/collection/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Grouping
            baseQuery += ` GROUP BY collections.id, nft_balances.owner`;
            // Sorting
            baseQuery += ` ORDER BY collections.all_time_volume DESC`;
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            const result = await db_1.redb.manyOrNone(baseQuery, { ...params, ...query });
            const collections = lodash_1.default.map(result, (r) => ({
                collection: {
                    id: r.id,
                    name: r.name,
                    metadata: r.metadata,
                    floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                    topBidValue: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                },
                ownership: {
                    tokenCount: String(r.token_count),
                    onSaleCount: String(r.on_sale_count),
                    liquidCount: String(r.liquid_count),
                },
            }));
            return { collections };
        }
        catch (error) {
            logger_1.logger.error(`get-user-collections-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map