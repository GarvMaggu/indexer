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
exports.putSetCollectionCommunityV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const Boom = __importStar(require("@hapi/boom"));
const collections_1 = require("@/models/collections");
const api_keys_1 = require("@/models/api-keys");
const lodash_1 = __importDefault(require("lodash"));
const version = "v1";
exports.putSetCollectionCommunityV1Options = {
    description: "Set a community for a specific collection",
    tags: ["api", "Collections"],
    plugins: {
        "hapi-swagger": {
            order: 13,
        },
    },
    validate: {
        headers: joi_1.default.object({
            "x-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .required()
                .description("Update community for a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`. Requires an authorized api key to be passed."),
        }),
        payload: joi_1.default.object({
            community: joi_1.default.string().lowercase().required().allow(""),
        }),
    },
    response: {
        schema: joi_1.default.object({
            message: joi_1.default.string(),
        }).label(`putSetCollectionCommunity${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`put-set-collection-community-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b;
        const payload = request.payload;
        const params = request.params;
        const apiKey = await api_keys_1.ApiKeyManager.getApiKey(request.headers["x-api-key"]);
        if (lodash_1.default.isNull(apiKey)) {
            throw Boom.unauthorized("Invalid API key");
        }
        try {
            if (payload.community === "") {
                const collection = await collections_1.Collections.getById(params.collection);
                // If no collection found
                if (lodash_1.default.isNull(collection)) {
                    throw Boom.badRequest(`Collection ${params.collection} not found`);
                }
                if (((_a = apiKey.permissions) === null || _a === void 0 ? void 0 : _a.assign_collection_to_community) != collection.community) {
                    throw Boom.unauthorized("Not allowed");
                }
            }
            else if (((_b = apiKey.permissions) === null || _b === void 0 ? void 0 : _b.assign_collection_to_community) != payload.community) {
                throw Boom.unauthorized("Not allowed");
            }
            await collections_1.Collections.update(params.collection, { community: payload.community });
            return { message: "Success" };
        }
        catch (error) {
            logger_1.logger.error(`put-set-collection-community-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map