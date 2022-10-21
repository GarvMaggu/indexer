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
exports.postOrdersV1Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const orderbookOrders = __importStar(require("@/jobs/orderbook/orders-queue"));
const version = "v1";
exports.postOrdersV1Options = {
    description: "Submit order batch",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            orders: joi_1.default.array().items(joi_1.default.object({
                kind: joi_1.default.string()
                    .lowercase()
                    .valid("looks-rare", "zeroex-v4", "x2y2", "seaport")
                    .required(),
                data: joi_1.default.object().required(),
            })),
        }),
    },
    handler: async (request) => {
        if (index_1.config.disableOrders) {
            throw Boom.badRequest("Order posting is disabled");
        }
        // This is only to support X2Y2 orders which cannot be validated
        // in a trustless way (eg. their APIs do not return the raw data
        // of the orders for anyone to validate).
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const orders = payload.orders;
            logger_1.logger.info(`post-orders-${version}-handler`, `Got ${orders.length} orders`);
            const orderInfos = [];
            for (const { kind, data } of orders) {
                orderInfos.push({
                    kind,
                    info: {
                        orderParams: data,
                        metadata: {},
                    },
                    relayToArweave: true,
                    validateBidValue: true,
                });
            }
            await orderbookOrders.addToQueue(orderInfos);
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error(`post-orders-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map