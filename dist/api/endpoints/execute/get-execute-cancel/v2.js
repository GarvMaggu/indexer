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
exports.getExecuteCancelV2Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const version = "v2";
exports.getExecuteCancelV2Options = {
    description: "Cancel order",
    notes: "Cancel an existing order on any marketplace",
    tags: ["api", "Router"],
    plugins: {
        "hapi-swagger": {
            order: 11,
        },
    },
    validate: {
        query: joi_1.default.object({
            // TODO: Add support for batch cancellations (where possible)
            id: joi_1.default.string()
                .required()
                .description("Order Id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
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
                kind: joi_1.default.string().valid("transaction").required(),
                items: joi_1.default.array()
                    .items(joi_1.default.object({
                    status: joi_1.default.string().valid("complete", "incomplete").required(),
                    data: joi_1.default.object(),
                    orderIndex: joi_1.default.number(),
                }))
                    .required(),
            })),
        }).label(`getExecuteCancel${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-cancel-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            // Fetch the order to get cancelled
            const orderResult = await db_1.redb.oneOrNone(`
          SELECT
            orders.kind,
            orders.raw_data
          FROM orders
          WHERE orders.id = $/id/
            AND orders.maker = $/maker/
            AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
        `, {
                id: query.id,
                maker: (0, utils_1.toBuffer)(query.maker),
            });
            // Return early in case no order was found
            if (!orderResult) {
                throw Boom.badData("No matching order");
            }
            let cancelTx;
            let orderSide;
            // REFACTOR: Move to SDK and handle X2Y2
            switch (orderResult.kind) {
                case "seaport": {
                    const order = new Sdk.Seaport.Order(index_1.config.chainId, orderResult.raw_data);
                    const exchange = new Sdk.Seaport.Exchange(index_1.config.chainId);
                    cancelTx = exchange.cancelOrderTx(query.maker, order);
                    orderSide = order.getInfo().side;
                    break;
                }
                case "looks-rare": {
                    const order = new Sdk.LooksRare.Order(index_1.config.chainId, orderResult.raw_data);
                    const exchange = new Sdk.LooksRare.Exchange(index_1.config.chainId);
                    cancelTx = exchange.cancelOrderTx(query.maker, order);
                    orderSide = order.params.isOrderAsk ? "sell" : "buy";
                    break;
                }
                case "zeroex-v4-erc721":
                case "zeroex-v4-erc1155": {
                    const order = new Sdk.ZeroExV4.Order(index_1.config.chainId, orderResult.raw_data);
                    const exchange = new Sdk.ZeroExV4.Exchange(index_1.config.chainId);
                    cancelTx = exchange.cancelOrderTx(query.maker, order);
                    orderSide =
                        order.params.direction === Sdk.ZeroExV4.Types.TradeDirection.SELL ? "sell" : "buy";
                    break;
                }
                case "universe": {
                    const order = new Sdk.Universe.Order(index_1.config.chainId, orderResult.raw_data);
                    const exchange = new Sdk.Universe.Exchange(index_1.config.chainId);
                    const { side } = order.getInfo();
                    cancelTx = await exchange.cancelOrderTx(order.params);
                    orderSide = side;
                    break;
                }
                // TODO: Add support for X2Y2 (it's tricky because of the signature requirement)
                default: {
                    throw Boom.notImplemented("Unsupported order kind");
                }
            }
            // TODO: We should remove the "listing"/"offer" distinction once we get to bundles
            return {
                steps: [
                    {
                        action: orderSide === "sell" ? "Submit cancellation" : "Cancel offer",
                        description: `To cancel this ${orderSide === "sell" ? "listing" : "offer"} you must confirm the transaction and pay the gas fee`,
                        kind: "transaction",
                        items: [
                            {
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
                                orderIndex: 0,
                            },
                        ],
                    },
                ],
            };
        }
        catch (error) {
            logger_1.logger.error(`get-execute-cancel-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map