"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttributesAllV2Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v2";
exports.getAttributesAllV2Options = {
    description: "All attributes",
    tags: ["api", "Attributes"],
    plugins: {
        "hapi-swagger": {
            order: 2,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            attributes: joi_1.default.array().items(joi_1.default.object({
                key: joi_1.default.string().required(),
                attributeCount: joi_1.default.number(),
                kind: joi_1.default.string().valid("string", "number", "date", "range").required(),
                minRange: joi_1.default.number().unsafe().allow(null),
                maxRange: joi_1.default.number().unsafe().allow(null),
                values: joi_1.default.array().items(joi_1.default.object({
                    value: joi_1.default.string().required(),
                    count: joi_1.default.number(),
                    floorAskPrice: joi_1.default.number().unsafe().allow(null),
                })),
            })),
        }).label(`getAttributesAll${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-attributes-all-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        try {
            const baseQuery = `
        SELECT key, kind, rank, attribute_count, array_agg(info) AS "values"
        FROM attribute_keys
        WHERE collection_id = $/collection/
        AND kind = 'number'
        GROUP BY id
        
        UNION
        
        SELECT attribute_keys.key, attribute_keys.kind, rank, attribute_count,
               array_agg(jsonb_build_object('value', attributes.value, 'count', attributes.token_count, 'floor_sell_value', attributes.floor_sell_value::text)) AS "values"
        FROM attribute_keys
        JOIN attributes ON attribute_keys.id = attributes.attribute_key_id
        WHERE attribute_keys.collection_id = $/collection/
        AND attribute_keys.kind = 'string'
        AND attributes.token_count > 0
        GROUP BY attribute_keys.id
        ORDER BY rank DESC
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, params).then((result) => {
                return result.map((r) => {
                    if (r.values.count == 0) {
                        return undefined;
                    }
                    if (r.kind == "number") {
                        return {
                            key: r.key,
                            kind: r.kind,
                            minRange: lodash_1.default.isArray(r.values)
                                ? Number(lodash_1.default.first(r.values)["min_range"])
                                : null,
                            maxRange: lodash_1.default.isArray(r.values)
                                ? Number(lodash_1.default.first(r.values)["max_range"])
                                : null,
                        };
                    }
                    else {
                        return {
                            key: r.key,
                            attributeCount: Number(r.attribute_count),
                            kind: r.kind,
                            values: lodash_1.default.map(r.values, (value) => ({
                                count: value.count,
                                value: value.value,
                                floorAskPrice: value.floor_sell_value
                                    ? (0, utils_1.formatEth)(value.floor_sell_value)
                                    : undefined,
                            })),
                        };
                    }
                });
            });
            return { attributes: result };
        }
        catch (error) {
            logger_1.logger.error(`get-attributes-all-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map