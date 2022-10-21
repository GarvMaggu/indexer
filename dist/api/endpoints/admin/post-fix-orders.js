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
exports.postFixOrdersOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const orderFixes = __importStar(require("@/jobs/order-fixes/queue"));
exports.postFixOrdersOptions = {
    description: "Trigger fixing any order inconsistencies.",
    tags: ["api", "x-admin"],
    timeout: {
        server: 2 * 60 * 1000,
    },
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            by: joi_1.default.string().valid("id", "maker", "token", "contract").required(),
            id: joi_1.default.string().when("by", {
                is: "id",
                then: joi_1.default.required(),
                otherwise: joi_1.default.forbidden(),
            }),
            token: joi_1.default.string().lowercase().pattern(utils_1.regex.token).when("by", {
                is: "token",
                then: joi_1.default.required(),
                otherwise: joi_1.default.forbidden(),
            }),
            maker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).when("by", {
                is: "maker",
                then: joi_1.default.required(),
                otherwise: joi_1.default.forbidden(),
            }),
            contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address).when("by", {
                is: "contract",
                then: joi_1.default.required(),
                otherwise: joi_1.default.forbidden(),
            }),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const by = payload.by;
            if (by === "id") {
                await orderFixes.addToQueue([{ by, data: { id: payload.id } }]);
            }
            else if (by === "maker") {
                await orderFixes.addToQueue([{ by, data: { maker: payload.maker } }]);
            }
            else if (by === "contract") {
                await orderFixes.addToQueue([{ by, data: { contract: payload.contract } }]);
            }
            else if (by === "token") {
                await orderFixes.addToQueue([{ by, data: { token: payload.token } }]);
            }
            return { message: "Success" };
        }
        catch (error) {
            logger_1.logger.error("post-fix-orders-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-fix-orders.js.map