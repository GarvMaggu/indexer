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
exports.getExecuteCancelV1Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const version = "v1";
exports.getExecuteCancelV1Options = {
    description: "Cancel order",
    notes: "Cancel an existing order on any marketplace",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            id: joi_1.default.string()
                .required()
                .description("Order Id. Example: `0x1544e82e6f2174f26233abcc35f3d478fa9c92926a91465430657987aea7d748`"),
            maker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Address of wallet cancelling the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            maxFeePerGas: joi_1.default.string()
                .pattern(utils_1.regex.number)
                .description("Optional. Set custom gas price"),
            maxPriorityFeePerGas: joi_1.default.string()
                .pattern(utils_1.regex.number)
                .description("Optional. Set custom gas price"),
        }),
    },
    response: {
        schema: joi_1.default.object({
            steps: joi_1.default.array().items(joi_1.default.object({
                action: joi_1.default.string().required(),
                description: joi_1.default.string().required(),
                status: joi_1.default.string().valid("complete", "incomplete").required(),
                kind: joi_1.default.string()
                    .valid("request", "signature", "transaction", "confirmation")
                    .required(),
                data: joi_1.default.object(),
            })),
            query: joi_1.default.object(),
        }).label(`getExecuteCancel${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-cancel-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            // Fetch the order to get cancelled.
            const orderResult = await db_1.redb.oneOrNone(`
          SELECT "kind", "raw_data" FROM "orders"
          WHERE "id" = $/id/
            AND "maker" = $/maker/
            AND ("fillability_status" = 'fillable' OR "fillability_status" = 'no-balance')
        `, {
                id: query.id,
                maker: (0, utils_1.toBuffer)(query.maker),
            });
            // Return early in case no order was found.
            if (!orderResult) {
                throw Boom.badData("No matching order");
            }
            // Set up generic cancellation steps.
            const generateSteps = (side) => [
                {
                    action: side === "sell" ? "Submit cancellation" : "Cancel offer",
                    description: `To cancel this ${side === "sell" ? "listing" : "offer"} you must confirm the transaction and pay the gas fee`,
                    kind: "transaction",
                },
                {
                    action: "Confirmation",
                    description: `Verify that the ${side === "sell" ? "listing" : "offer"} was successfully cancelled`,
                    kind: "confirmation",
                },
            ];
            switch (orderResult.kind) {
                case "seaport": {
                    const order = new Sdk.Seaport.Order(index_1.config.chainId, orderResult.raw_data);
                    // Generate exchange-specific cancellation transaction.
                    const exchange = new Sdk.Seaport.Exchange(index_1.config.chainId);
                    const cancelTx = exchange.cancelOrderTx(query.maker, order);
                    const steps = generateSteps(order.getInfo().side);
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: "incomplete",
                                data: {
                                    ...cancelTx,
                                    maxFeePerGas: query.maxFeePerGas
                                        ? (0, utils_1.bn)(query.maxFeePerGas).toHexString()
                                        : undefined,
                                    maxPriorityFeePerGas: query.maxPriorityFeePerGas
                                        ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                                        : undefined,
                                },
                            },
                            {
                                ...steps[1],
                                status: "incomplete",
                                data: {
                                    endpoint: `/orders/executed/v1?ids=${order.hash()}`,
                                    method: "GET",
                                },
                            },
                        ],
                    };
                }
                case "looks-rare": {
                    const order = new Sdk.LooksRare.Order(index_1.config.chainId, orderResult.raw_data);
                    // Generate exchange-specific cancellation transaction.
                    const exchange = new Sdk.LooksRare.Exchange(index_1.config.chainId);
                    const cancelTx = exchange.cancelOrderTx(query.maker, order);
                    const steps = generateSteps(order.params.isOrderAsk ? "sell" : "buy");
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: "incomplete",
                                data: {
                                    ...cancelTx,
                                    maxFeePerGas: query.maxFeePerGas
                                        ? (0, utils_1.bn)(query.maxFeePerGas).toHexString()
                                        : undefined,
                                    maxPriorityFeePerGas: query.maxPriorityFeePerGas
                                        ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                                        : undefined,
                                },
                            },
                            {
                                ...steps[1],
                                status: "incomplete",
                                data: {
                                    endpoint: `/orders/executed/v1?ids=${order.hash()}`,
                                    method: "GET",
                                },
                            },
                        ],
                    };
                }
                case "zeroex-v4-erc721":
                case "zeroex-v4-erc1155": {
                    const order = new Sdk.ZeroExV4.Order(index_1.config.chainId, orderResult.raw_data);
                    // Generate exchange-specific cancellation transaction.
                    const exchange = new Sdk.ZeroExV4.Exchange(index_1.config.chainId);
                    const cancelTx = exchange.cancelOrderTx(query.maker, order);
                    const steps = generateSteps(order.params.direction === Sdk.ZeroExV4.Types.TradeDirection.SELL ? "sell" : "buy");
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: "incomplete",
                                data: {
                                    ...cancelTx,
                                    maxFeePerGas: query.maxFeePerGas
                                        ? (0, utils_1.bn)(query.maxFeePerGas).toHexString()
                                        : undefined,
                                    maxPriorityFeePerGas: query.maxPriorityFeePerGas
                                        ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                                        : undefined,
                                },
                            },
                            {
                                ...steps[1],
                                status: "incomplete",
                                data: {
                                    endpoint: `/orders/executed/v1?ids=${order.hash()}`,
                                    method: "GET",
                                },
                            },
                        ],
                    };
                }
                case "x2y2": {
                    const order = new Sdk.X2Y2.Order(index_1.config.chainId, orderResult.raw_data);
                    // Generate exchange-specific cancellation transaction
                    const exchange = new Sdk.X2Y2.Exchange(index_1.config.chainId, process.env.X2Y2_API_KEY);
                    const cancelTx = exchange.cancelOrderTx(query.maker, order);
                    const steps = generateSteps(order.params.type);
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: "incomplete",
                                data: {
                                    ...cancelTx,
                                    maxFeePerGas: query.maxFeePerGas
                                        ? (0, utils_1.bn)(query.maxFeePerGas).toHexString()
                                        : undefined,
                                    maxPriorityFeePerGas: query.maxPriorityFeePerGas
                                        ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                                        : undefined,
                                },
                            },
                            {
                                ...steps[1],
                                status: "incomplete",
                                data: {
                                    endpoint: `/orders/executed/v1?ids=${order.params.itemHash}`,
                                    method: "GET",
                                },
                            },
                        ],
                    };
                }
                default: {
                    throw Boom.notImplemented("Unsupported order kind");
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`get-execute-cancel-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map