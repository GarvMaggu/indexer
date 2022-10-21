"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedirectLogoV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const sources_1 = require("@/models/sources");
const version = "v1";
exports.getRedirectLogoV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 60000,
    },
    description: "Redirect response to the given source logo",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 53,
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            source: joi_1.default.string().required(),
        }),
    },
    handler: async (request, response) => {
        const query = request.query;
        const sources = await sources_1.Sources.getInstance();
        try {
            let source = sources.getByName(query.source, false);
            if (!source) {
                source = sources.getByDomain(query.source);
            }
            if (source === null || source === void 0 ? void 0 : source.metadata.adminIcon) {
                return response
                    .redirect(source === null || source === void 0 ? void 0 : source.metadata.adminIcon)
                    .header("cache-control", `${1000 * 60}`);
            }
            return response.redirect(source === null || source === void 0 ? void 0 : source.metadata.icon);
        }
        catch (error) {
            logger_1.logger.error(`get-redirect-logo-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map