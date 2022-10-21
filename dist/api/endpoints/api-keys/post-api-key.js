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
exports.postApiKey = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const api_keys_1 = require("../../../models/api-keys");
const index_1 = require("@/config/index");
const Boom = __importStar(require("@hapi/boom"));
exports.postApiKey = {
    description: "Generate API Key",
    notes: "The API key can be used in every route, by setting it as a request header **x-api-key**.\n\n<a href='https://docs.reservoir.tools/reference/getting-started'>Learn more</a> about API Keys and Rate Limiting",
    tags: ["api", "Management"],
    plugins: {
        "hapi-swagger": {
            payloadType: "form",
            orders: 13,
        },
    },
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            appName: joi_1.default.string().required().description("The name of your app"),
            email: joi_1.default.string()
                .email()
                .required()
                .description("An e-mail address where you can be reached, in case of issues, to avoid service disruption"),
            website: joi_1.default.string().required().description("The website of your project"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            key: joi_1.default.string().required().uuid(),
        }).label("getNewApiKeyResponse"),
        failAction: (_request, _h, error) => {
            logger_1.logger.error("post-api-key-handler", `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const manager = new api_keys_1.ApiKeyManager();
            const key = await manager.create({
                app_name: payload.appName,
                website: payload.website,
                email: payload.email,
                tier: 1,
            });
            if (!key) {
                throw new Error("Unable to create a new api key with given values");
            }
            return key;
        }
        catch (error) {
            logger_1.logger.error("post-api-key-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-api-key.js.map