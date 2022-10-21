"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttributesAllV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const version = "v1";
exports.getAttributesAllV1Options = {
    description: "Get all attributes in a collection",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            attributes: joi_1.default.array().items(joi_1.default.object({
                key: joi_1.default.string().required(),
                kind: joi_1.default.string().valid("string", "number", "date", "range").required(),
                values: joi_1.default.array().items(joi_1.default.object({
                    value: joi_1.default.string().required(),
                    count: joi_1.default.number(),
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
        SELECT
          "ak"."key",
          "ak"."kind",
          array_agg(json_build_object('value', "a"."value", 'count', "a"."token_count")) AS "values"
        FROM "attribute_keys" "ak"
        JOIN "attributes" "a"
          ON "ak"."id" = "a"."attribute_key_id"
        WHERE "ak"."collection_id" = $/collection/
          AND "ak"."rank" IS NOT NULL
          AND "a"."token_count" > 0
        GROUP BY "ak"."id"
        ORDER BY "ak"."rank" DESC
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, params).then((result) => result.map((r) => ({
                key: r.key,
                kind: r.kind,
                values: r.values,
            })));
            return { attributes: result };
        }
        catch (error) {
            logger_1.logger.error(`get-attributes-all-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map