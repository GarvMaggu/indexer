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
exports.getRedirectCollectionImageV1Options = void 0;
const lodash_1 = __importDefault(require("lodash"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const collections_1 = require("@/models/collections");
const Boom = __importStar(require("@hapi/boom"));
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getRedirectCollectionImageV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 60000,
    },
    description: "Redirect to the given collection image",
    tags: ["api", "Redirects"],
    plugins: {
        "hapi-swagger": {
            order: 53,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Redirect to the given collection image. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
    },
    handler: async (request, response) => {
        const params = request.params;
        try {
            const collection = await collections_1.Collections.getById(params.collection, true);
            if (lodash_1.default.isNull(collection) || lodash_1.default.isNull(collection.metadata)) {
                throw Boom.badData(`Collection ${params.collection} not found`);
            }
            return response
                .redirect(collection.metadata.imageUrl)
                .header("cache-control", `${1000 * 60}`);
        }
        catch (error) {
            logger_1.logger.error(`get-redirect-collection-image-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map