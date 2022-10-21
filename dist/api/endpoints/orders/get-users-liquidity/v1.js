"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersLiquidityV1Options = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const version = "v1";
exports.getUsersLiquidityV1Options = {
    description: "User bid liquidity rankings",
    notes: "This API calculates the total liquidity created by users, based on the number of tokens they are top bidder for.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 7,
        },
    },
    validate: {
        query: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            user: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular user. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            offset: joi_1.default.number()
                .integer()
                .min(0)
                .max(10000)
                .default(0)
                .description("Use offset to request the next batch of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(20)
                .default(20)
                .description("Amount of items returned in response."),
        })
            .or("collection", "user")
            .oxor("collection", "user"),
    },
    response: {
        schema: joi_1.default.object({
            liquidity: joi_1.default.array().items(joi_1.default.object({
                user: joi_1.default.string()
                    .lowercase()
                    .pattern(/^0x[a-fA-F0-9]{40}$/),
                rank: joi_1.default.number().required(),
                tokenCount: joi_1.default.string().required(),
                liquidity: joi_1.default.number().unsafe().required(),
                maxTopBuyValue: joi_1.default.number().unsafe().required(),
                wethBalance: joi_1.default.number().unsafe().required(),
            })),
        }).label(`getUsersLiquidity${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-users-liquidity-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          "t"."top_buy_maker" AS "user",
          SUM("t"."top_buy_value") as "liquidity",
          MAX("t"."top_buy_value") as "max_top_buy_value",
          RANK() OVER (ORDER BY SUM("t"."top_buy_value") DESC NULLS LAST) AS "rank",
          COUNT(*) AS "token_count"
        FROM "tokens" "t"
      `;
            const conditions = [`"t"."top_buy_maker" IS NOT NULL`];
            if (query.collection) {
                conditions.push(`"t"."collection_id" = $/collection/`);
            }
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Grouping
            baseQuery += ` GROUP BY "t"."top_buy_maker"`;
            // Sorting
            baseQuery += ` ORDER BY "rank", "t"."top_buy_maker"`;
            // Pagination
            baseQuery += ` OFFSET $/offset/`;
            baseQuery += ` LIMIT $/limit/`;
            baseQuery = `
        WITH "x" AS (${baseQuery})
        SELECT
          "x".*,
          (
            SELECT
              COALESCE("fb"."amount", 0)
            FROM "ft_balances" "fb"
            WHERE "fb"."contract" = $/weth/
              and "fb"."owner" = "x"."user"
              and "fb"."amount" > 0
          ) AS "weth_balance"
        FROM "x"
      `;
            query.weth = (0, utils_1.toBuffer)(Sdk.Common.Addresses.Weth[index_1.config.chainId]);
            if (query.user) {
                query.user = (0, utils_1.toBuffer)(query.user);
                baseQuery += ` WHERE "x"."user" = $/user/`;
            }
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => ({
                user: (0, utils_1.fromBuffer)(r.user),
                rank: Number(r.rank),
                liquidity: (0, utils_1.formatEth)(r.liquidity),
                maxTopBuyValue: (0, utils_1.formatEth)(r.max_top_buy_value),
                tokenCount: String(r.token_count),
                wethBalance: r.weth_balance ? (0, utils_1.formatEth)(r.weth_balance) : null,
            })));
            return { liquidity: result };
        }
        catch (error) {
            logger_1.logger.error(`get-users-liquidity-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map