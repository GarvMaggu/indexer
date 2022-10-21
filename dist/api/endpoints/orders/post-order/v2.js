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
exports.postOrderV2Options = void 0;
const bytes_1 = require("@ethersproject/bytes");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const orders = __importStar(require("@/orderbook/orders"));
const postOrderExternal = __importStar(require("@/jobs/orderbook/post-order-external"));
const version = "v2";
exports.postOrderV2Options = {
    description: "Submit single order",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 5,
        },
    },
    validate: {
        query: joi_1.default.object({
            signature: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]+$/),
        }),
        payload: joi_1.default.object({
            order: joi_1.default.object({
                kind: joi_1.default.string()
                    .lowercase()
                    .valid("opensea", "looks-rare", "zeroex-v4", "seaport", "x2y2")
                    .required(),
                data: joi_1.default.object().required(),
            }),
            orderbook: joi_1.default.string()
                .lowercase()
                .valid("reservoir", "opensea", "looks-rare")
                .default("reservoir"),
            orderbookApiKey: joi_1.default.string(),
            source: joi_1.default.string().description("The name of the source"),
            attribute: joi_1.default.object({
                collection: joi_1.default.string().required(),
                key: joi_1.default.string().required(),
                value: joi_1.default.string().required(),
            }),
            collection: joi_1.default.string(),
            tokenSetId: joi_1.default.string(),
            isNonFlagged: joi_1.default.boolean(),
        }).oxor("tokenSetId", "collection", "attribute"),
    },
    handler: async (request) => {
        var _a;
        if (index_1.config.disableOrders) {
            throw Boom.badRequest("Order posting is disabled");
        }
        const query = request.query;
        const payload = request.payload;
        try {
            const order = payload.order;
            const orderbook = payload.orderbook;
            const orderbookApiKey = payload.orderbookApiKey || null;
            const source = payload.source;
            // We'll always have only one of the below cases:
            // Only relevant/present for attribute bids
            const attribute = payload.attribute;
            // Only relevant for collection bids
            const collection = payload.collection;
            // Only relevant for token set bids
            const tokenSetId = payload.tokenSetId;
            // Only relevant for non-flagged tokens bids
            const isNonFlagged = payload.isNonFlagged;
            const signature = (_a = query.signature) !== null && _a !== void 0 ? _a : order.data.signature;
            if (signature) {
                const { v, r, s } = (0, bytes_1.splitSignature)(signature);
                // If the signature is provided via query parameters, use it
                order.data = {
                    ...order.data,
                    // To cover everything:
                    // - orders requiring a single signature field
                    // - orders requiring split signature fields
                    signature,
                    v,
                    r,
                    s,
                };
            }
            let schema;
            if (attribute) {
                schema = {
                    kind: "attribute",
                    data: {
                        collection: attribute.collection,
                        isNonFlagged: isNonFlagged || undefined,
                        attributes: [
                            {
                                key: attribute.key,
                                value: attribute.value,
                            },
                        ],
                    },
                };
            }
            else if (collection && isNonFlagged) {
                schema = {
                    kind: "collection-non-flagged",
                    data: {
                        collection,
                    },
                };
            }
            else if (collection) {
                schema = {
                    kind: "collection",
                    data: {
                        collection,
                    },
                };
            }
            else if (tokenSetId) {
                schema = {
                    kind: "token-set",
                    data: {
                        tokenSetId,
                    },
                };
            }
            switch (order.kind) {
                case "zeroex-v4": {
                    if (orderbook !== "reservoir") {
                        throw new Error("Unsupported orderbook");
                    }
                    const orderInfo = {
                        orderParams: order.data,
                        metadata: {
                            schema,
                            source,
                        },
                    };
                    const [result] = await orders.zeroExV4.save([orderInfo]);
                    if (result.status === "success") {
                        return { message: "Success", orderId: result.id };
                    }
                    else {
                        const error = Boom.badRequest(result.status);
                        error.output.payload.orderId = result.id;
                        throw error;
                    }
                }
                case "seaport": {
                    if (!["opensea", "reservoir"].includes(orderbook)) {
                        throw new Error("Unsupported orderbook");
                    }
                    const orderInfo = {
                        orderParams: order.data,
                        isReservoir: orderbook === "reservoir",
                        metadata: {
                            schema,
                            source: orderbook === "reservoir" ? source : undefined,
                        },
                    };
                    const [result] = await orders.seaport.save([orderInfo]);
                    if (result.status !== "success") {
                        const error = Boom.badRequest(result.status);
                        error.output.payload.orderId = result.id;
                        throw error;
                    }
                    if (orderbook === "opensea") {
                        await postOrderExternal.addToQueue(result.id, order.data, orderbook, orderbookApiKey);
                        logger_1.logger.info(`post-order-${version}-handler`, `orderbook: ${orderbook}, orderData: ${JSON.stringify(order.data)}, orderId: ${result.id}`);
                    }
                    return { message: "Success", orderId: result.id };
                }
                case "looks-rare": {
                    if (!["looks-rare", "reservoir"].includes(orderbook)) {
                        throw new Error("Unsupported orderbook");
                    }
                    const orderInfo = {
                        orderParams: order.data,
                        metadata: {
                            schema,
                            source: orderbook === "reservoir" ? source : undefined,
                        },
                    };
                    const [result] = await orders.looksRare.save([orderInfo]);
                    if (result.status !== "success") {
                        const error = Boom.badRequest(result.status);
                        error.output.payload.orderId = result.id;
                        throw error;
                    }
                    if (orderbook === "looks-rare") {
                        await postOrderExternal.addToQueue(result.id, order.data, orderbook, orderbookApiKey);
                        logger_1.logger.info(`post-order-${version}-handler`, `orderbook: ${orderbook}, orderData: ${JSON.stringify(order.data)}, orderId: ${result.id}`);
                    }
                    return { message: "Success", orderId: result.id };
                }
                case "opensea": {
                    if (orderbook !== "reservoir") {
                        throw new Error("Unsupported orderbook");
                    }
                    const orderObject = new Sdk.Seaport.Order(index_1.config.chainId, {
                        ...order.data.parameters,
                        signature: order.data.signature,
                    });
                    const orderInfo = {
                        orderParams: orderObject.params,
                        metadata: {
                            schema,
                        },
                    };
                    const [result] = await orders.seaport.save([orderInfo]);
                    if (result.status !== "success") {
                        const error = Boom.badRequest(result.status);
                        error.output.payload.orderId = result.id;
                        throw error;
                    }
                    return { message: "Success", orderId: result.id };
                }
                case "x2y2": {
                    if (orderbook !== "reservoir") {
                        throw new Error("Unsupported orderbook");
                    }
                    const orderInfo = {
                        orderParams: order.data,
                        metadata: {
                            schema,
                        },
                    };
                    const [result] = await orders.x2y2.save([orderInfo]);
                    if (result.status !== "success") {
                        const error = Boom.badRequest(result.status);
                        error.output.payload.orderId = result.id;
                        throw error;
                    }
                    return { message: "Success", orderId: result.id };
                }
            }
            return { message: "Request accepted" };
        }
        catch (error) {
            logger_1.logger.error(`post-order-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map