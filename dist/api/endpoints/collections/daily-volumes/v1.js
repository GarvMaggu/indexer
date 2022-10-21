"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyVolumesV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getDailyVolumesV1Options = {
    description: "Daily collection volume",
    notes: "Get date, volume, rank and sales count for each collection",
    tags: ["api", "Stats"],
    plugins: {
        "hapi-swagger": {
            order: 7,
        },
    },
    validate: {
        query: joi_1.default.object({
            id: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`")
                .required(),
            limit: joi_1.default.number().default(60).description("Amount of items returned in response."),
            startTimestamp: joi_1.default.number().description("The start timestamp you want to filter on (UTC)"),
            endTimestamp: joi_1.default.number().description("The end timestamp you want to filter on (UTC)"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            collections: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string(),
                timestamp: joi_1.default.number(),
                volume: joi_1.default.number().unsafe(true),
                rank: joi_1.default.number(),
                floor_sell_value: joi_1.default.number().unsafe(true),
                sales_count: joi_1.default.number(),
            }).allow(null)),
        }).label(`getDailyVolumes${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-daily-volumes-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        let baseQuery = `
        SELECT
          collection_id AS id,
          timestamp,
          volume,
          rank,
          floor_sell_value,
          sales_count                    
        FROM daily_volumes
      `;
        baseQuery += ` WHERE collection_id = $/id/`;
        // We default in the code so that these values don't appear in the docs
        if (!query.startTimestamp) {
            query.startTimestamp = 0;
        }
        if (!query.endTimestamp) {
            query.endTimestamp = 9999999999;
        }
        baseQuery += " AND timestamp >= $/startTimestamp/ AND timestamp <= $/endTimestamp/";
        baseQuery += ` ORDER BY timestamp DESC`;
        baseQuery += ` LIMIT $/limit/`;
        try {
            let result = await db_1.redb.manyOrNone(baseQuery, query);
            result = result.map((r) => ({
                id: r.id,
                timestamp: r.timestamp,
                volume: (0, utils_1.formatEth)(r.volume),
                rank: r.rank,
                floor_sell_value: (0, utils_1.formatEth)(r.floor_sell_value),
                sales_count: r.sales_count,
            }));
            return { collections: result };
        }
        catch (error) {
            logger_1.logger.error(`get-daily-volumes-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map