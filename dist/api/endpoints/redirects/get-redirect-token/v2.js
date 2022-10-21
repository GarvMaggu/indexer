"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedirectTokenV2Options = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const sources_1 = require("@/models/sources");
const lodash_1 = __importDefault(require("lodash"));
const version = "v2";
exports.getRedirectTokenV2Options = {
    cache: {
        privacy: "public",
        expiresIn: 60000,
    },
    description: "Redirect response to the given source token page",
    tags: ["api", "Redirects"],
    plugins: {
        "hapi-swagger": {
            order: 53,
        },
    },
    validate: {
        params: joi_1.default.object({
            source: joi_1.default.string().required().description("Domain of the source. Example `opensea.io`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/)
                .required()
                .description("Redirect to the given token page. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
        }),
    },
    handler: async (request, response) => {
        const params = request.params;
        const sources = await sources_1.Sources.getInstance();
        try {
            let source = sources.getByName(params.source, false);
            if (!source) {
                source = sources.getByDomain(params.source);
            }
            if (!source) {
                throw new Error("Unknown source");
            }
            const [contract, tokenId] = params.token.split(":");
            const tokenUrl = sources.getTokenUrl(source, contract, tokenId);
            if (tokenUrl) {
                return response.redirect(tokenUrl).header("cache-control", `${1000 * 60}`);
            }
            let redirectUrl = source.domain;
            if (!lodash_1.default.startsWith(redirectUrl, "http")) {
                redirectUrl = `https://${redirectUrl}`;
            }
            return response.redirect(redirectUrl).header("cache-control", `${1000 * 60}`);
        }
        catch (error) {
            logger_1.logger.error(`get-redirect-token-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map