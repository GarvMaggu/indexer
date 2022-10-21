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
exports.getAssetV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const Boom = __importStar(require("@hapi/boom"));
const version = "v1";
exports.getAssetV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 1000 * 60 * 60 * 24 * 30,
    },
    description: "Return the asset based on the given param",
    tags: ["api", "x-admin"],
    plugins: {
        "hapi-swagger": {
            order: 3,
        },
    },
    validate: {
        query: joi_1.default.object({
            asset: joi_1.default.string().required(),
        }),
    },
    handler: async (request, response) => {
        const query = request.query;
        try {
            return response
                .redirect((0, utils_1.decrypt)(query.asset))
                .header("cache-control", `${1000 * 60 * 60 * 24 * 30}`);
        }
        catch (error) {
            logger_1.logger.error(`get-asset-${version}-handler`, `Asset: ${query.asset} Handler failure: ${error}`);
            const err = Boom.notFound(`Asset not found`);
            err.output.headers["cache-control"] = `${1000 * 60 * 60 * 24}`;
            throw err;
        }
    },
};
//# sourceMappingURL=v1.js.map