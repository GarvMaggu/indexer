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
exports.getRedirectCurrencyIconV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const currencies_1 = require("@/utils/currencies");
const Boom = __importStar(require("@hapi/boom"));
const version = "v1";
exports.getRedirectCurrencyIconV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 60000,
    },
    description: "Redirect response to the given currency address icon",
    tags: ["api", "Redirects"],
    plugins: {
        "hapi-swagger": {
            order: 53,
        },
    },
    validate: {
        params: joi_1.default.object({
            address: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Redirect to the given currency address icon. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
        }),
    },
    handler: async (request, response) => {
        var _a;
        const params = request.params;
        try {
            const currency = await (0, currencies_1.getCurrency)(params.address);
            const currencyIconImage = (_a = currency === null || currency === void 0 ? void 0 : currency.metadata) === null || _a === void 0 ? void 0 : _a.image;
            if (currencyIconImage) {
                return response.redirect(currencyIconImage).header("cache-control", `${1000 * 60}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`get-redirect-currency-icon-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
        throw Boom.notFound(`Currency address ${params.address} not found`);
    },
};
//# sourceMappingURL=v1.js.map