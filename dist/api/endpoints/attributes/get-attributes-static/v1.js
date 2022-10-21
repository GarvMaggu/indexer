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
exports.getAttributesStaticV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const Boom = __importStar(require("@hapi/boom"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const collections_1 = require("@/models/collections");
const version = "v1";
exports.getAttributesStaticV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 1000 * 60 * 60 * 24,
    },
    description: "All attributes + token ids",
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
                key: joi_1.default.string().allow("").required(),
                kind: joi_1.default.string().valid("string", "number", "date", "range").required(),
                values: joi_1.default.array().items(joi_1.default.object({
                    value: joi_1.default.string().required(),
                    count: joi_1.default.number(),
                    tokens: joi_1.default.array().items(joi_1.default.string().required()),
                })),
            })),
        }).label(`getAttributesStatic${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-attributes-static-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const collection = await collections_1.Collections.getById(params.collection);
        if (!collection || (collection === null || collection === void 0 ? void 0 : collection.tokenCount) > 30000) {
            throw Boom.badData("Collection not supported");
        }
        try {
            const baseQuery = `
        SELECT
          "ak"."key",
          "ak"."kind",
          array_agg(json_build_object(
            'value', "a"."value",
            'count', "a"."token_count",
            'tokens', (
              SELECT array_agg("ta"."token_id")::TEXT[] FROM "token_attributes" "ta"
              WHERE "ta"."attribute_id" = "a"."id"
            )
          )) AS "values"
        FROM "attribute_keys" "ak"
        JOIN "attributes" "a"
          ON "ak"."id" = "a"."attribute_key_id"
        WHERE "ak"."collection_id" = $/collection/
          AND "ak"."rank" IS NOT NULL
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
            logger_1.logger.error(`get-attributes-static-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map