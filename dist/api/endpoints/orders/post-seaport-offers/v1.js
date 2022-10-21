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
exports.postSeaportOffersV1Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const orderbookOrders = __importStar(require("@/jobs/orderbook/orders-queue"));
const version = "v1";
exports.postSeaportOffersV1Options = {
    description: "Submit multiple Seaport offers (compatible with OpenSea's API response)",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        payload: joi_1.default.object({
            seaport_offers: joi_1.default.array().items(joi_1.default.object({
                protocol_data: joi_1.default.object({
                    parameters: joi_1.default.any(),
                    signature: joi_1.default.string(),
                }),
            }).options({ allowUnknown: true })),
        }),
    },
    handler: async (request) => {
        if (index_1.config.disableOrders) {
            throw Boom.badRequest("Order posting is disabled");
        }
        const payload = request.payload;
        try {
            const orders = payload.seaport_offers;
            logger_1.logger.info(`post-seaport-offers-${version}-handler`, `Got ${orders.length} offers`);
            const orderInfos = [];
            for (const { protocol_data } of orders) {
                orderInfos.push({
                    kind: "seaport",
                    info: {
                        orderParams: {
                            ...protocol_data.parameters,
                            signature: protocol_data.signature,
                        },
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
            logger_1.logger.error(`post-seaport-offers-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map