"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCreateCollectionsSetV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const collection_sets_1 = require("@/models/collection-sets");
const version = "v1";
exports.postCreateCollectionsSetV1Options = {
    description: "Create Collection Set",
    tags: ["api", "Collections"],
    plugins: {
        "hapi-swagger": {
            order: 13,
        },
    },
    validate: {
        payload: joi_1.default.object({
            collections: joi_1.default.array()
                .items(joi_1.default.string()
                .lowercase()
                .description("Array of collections to gather in a set. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"))
                .min(1)
                .max(500)
                .required(),
        }),
    },
    response: {
        schema: joi_1.default.object({
            collectionsSetId: joi_1.default.string(),
        }).label(`postCreateCollectionsSet${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`post-create-collections-set-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const payload = request.payload;
        try {
            const collectionsSetId = await collection_sets_1.CollectionSets.add(payload.collections);
            return { collectionsSetId };
        }
        catch (error) {
            logger_1.logger.error(`post-create-collections-set-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map