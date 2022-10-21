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
exports.getExecuteListV3Options = void 0;
const constants_1 = require("@ethersproject/constants");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
// LooksRare
const looksRareSellToken = __importStar(require("@/orderbook/orders/looks-rare/build/sell/token"));
const looksRareCheck = __importStar(require("@/orderbook/orders/looks-rare/check"));
// Seaport
const seaportSellToken = __importStar(require("@/orderbook/orders/seaport/build/sell/token"));
const seaportCheck = __importStar(require("@/orderbook/orders/seaport/check"));
// X2Y2
const x2y2SellToken = __importStar(require("@/orderbook/orders/x2y2/build/sell/token"));
const x2y2Check = __importStar(require("@/orderbook/orders/x2y2/check"));
// ZeroExV4
const zeroExV4SellToken = __importStar(require("@/orderbook/orders/zeroex-v4/build/sell/token"));
const zeroExV4Check = __importStar(require("@/orderbook/orders/zeroex-v4/check"));
const version = "v3";
exports.getExecuteListV3Options = {
    description: "Create ask (listing)",
    notes: "Generate a listing and submit it to multiple marketplaces",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        payload: joi_1.default.object({
            maker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Address of wallet making the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            source: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.domain)
                .description("Domain of the platform that created the order. Example: `chimpers.xyz`"),
            params: joi_1.default.array().items(joi_1.default.object({
                token: joi_1.default.string()
                    .lowercase()
                    .pattern(utils_1.regex.token)
                    .required()
                    .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
                quantity: joi_1.default.number().description("Quanity of tokens user is listing. Only compatible with ERC1155 tokens. Example: `5`"),
                weiPrice: joi_1.default.string()
                    .pattern(utils_1.regex.number)
                    .required()
                    .description("Amount seller is willing to sell for in wei. Example: `1000000000000000000`"),
                orderKind: joi_1.default.string()
                    .valid("looks-rare", "zeroex-v4", "seaport", "x2y2")
                    .default("seaport")
                    .description("Exchange protocol used to create order. Example: `seaport`"),
                orderbook: joi_1.default.string()
                    .valid("opensea", "looks-rare", "reservoir", "x2y2")
                    .default("reservoir")
                    .description("Orderbook where order is placed. Example: `Reservoir`"),
                automatedRoyalties: joi_1.default.boolean()
                    .default(true)
                    .description("If true, royalties will be automatically included."),
                fee: joi_1.default.alternatives(joi_1.default.string().pattern(utils_1.regex.number), joi_1.default.number(), joi_1.default.array().items(joi_1.default.string().pattern(utils_1.regex.number)), joi_1.default.array().items(joi_1.default.number()).description("Fee amount in BPS. Example: `100`")),
                feeRecipient: joi_1.default.alternatives(joi_1.default.string().lowercase().pattern(utils_1.regex.address).disallow(constants_1.AddressZero), joi_1.default.array()
                    .items(joi_1.default.string().lowercase().pattern(utils_1.regex.address).disallow(constants_1.AddressZero))
                    .description("Wallet address of fee recipient. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`")),
                listingTime: joi_1.default.string()
                    .pattern(utils_1.regex.unixTimestamp)
                    .description("Unix timestamp (seconds) indicating when listing will be listed. Example: `1656080318`"),
                expirationTime: joi_1.default.string()
                    .pattern(utils_1.regex.unixTimestamp)
                    .description("Unix timestamp (seconds) indicating when listing will expire. Example: `1656080318`"),
                salt: joi_1.default.string()
                    .pattern(utils_1.regex.number)
                    .description("Optional. Random string to make the order unique"),
                nonce: joi_1.default.string().pattern(utils_1.regex.number).description("Optional. Set a custom nonce"),
                currency: joi_1.default.string()
                    .pattern(utils_1.regex.address)
                    .default(Sdk.Common.Addresses.Eth[index_1.config.chainId]),
            })
                .with("feeRecipient", "fee")
                .with("fee", "feeRecipient")),
        }),
    },
    response: {
        schema: joi_1.default.object({
            steps: joi_1.default.array().items(joi_1.default.object({
                kind: joi_1.default.string().valid("request", "signature", "transaction").required(),
                action: joi_1.default.string().required(),
                description: joi_1.default.string().required(),
                items: joi_1.default.array()
                    .items(joi_1.default.object({
                    status: joi_1.default.string().valid("complete", "incomplete").required(),
                    data: joi_1.default.object(),
                    orderIndex: joi_1.default.number(),
                }))
                    .required(),
            })),
        }).label(`getExecuteList${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-list-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b, _c, _d, _e, _f;
        const payload = request.payload;
        try {
            const maker = payload.maker;
            const source = payload.source;
            // Set up generic listing steps
            const steps = [
                {
                    action: "Approve NFT contract",
                    description: "Each NFT collection you want to trade requires a one-time approval transaction",
                    kind: "transaction",
                    items: [],
                },
                {
                    action: "Authorize listing",
                    description: "A free off-chain signature to create the listing",
                    kind: "signature",
                    items: [],
                },
            ];
            for (let i = 0; i < payload.params.length; i++) {
                const params = payload.params[i];
                const [contract, tokenId] = params.token.split(":");
                if (params.orderKind !== "seaport" &&
                    params.currency !== Sdk.Common.Addresses.Eth[index_1.config.chainId]) {
                    throw new Error("ERC20 listings are only supported on Seaport");
                }
                switch (params.orderKind) {
                    case "zeroex-v4": {
                        // Exchange-specific checks
                        if (!["reservoir"].includes(params.orderbook)) {
                            throw Boom.badRequest("Unsupported orderbook");
                        }
                        // Make sure the fee information is correctly typed
                        if (params.fee && !Array.isArray(params.fee)) {
                            params.fee = [params.fee];
                        }
                        if (params.feeRecipient && !Array.isArray(params.feeRecipient)) {
                            params.feeRecipient = [params.feeRecipient];
                        }
                        if (((_a = params.fee) === null || _a === void 0 ? void 0 : _a.length) !== ((_b = params.feeRecipient) === null || _b === void 0 ? void 0 : _b.length)) {
                            throw Boom.badRequest("Invalid fee information");
                        }
                        const order = await zeroExV4SellToken.build({
                            ...params,
                            maker,
                            contract,
                            tokenId,
                        });
                        if (!order) {
                            throw Boom.internal("Failed to generate order");
                        }
                        // Will be set if an approval is needed before listing
                        let approvalTx;
                        // Check the order's fillability.
                        try {
                            await zeroExV4Check.offChainCheck(order, { onChainApprovalRecheck: true });
                        }
                        catch (error) {
                            switch (error.message) {
                                case "no-balance-no-approval":
                                case "no-balance": {
                                    // We cannot do anything if the user doesn't own the listed token
                                    throw Boom.badData("Maker does not own the listed token");
                                }
                                case "no-approval": {
                                    // Generate an approval transaction
                                    const kind = ((_c = order.params.kind) === null || _c === void 0 ? void 0 : _c.startsWith("erc721")) ? "erc721" : "erc1155";
                                    approvalTx = (kind === "erc721"
                                        ? new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, order.params.nft)
                                        : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, order.params.nft)).approveTransaction(maker, Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId]);
                                    break;
                                }
                            }
                        }
                        steps[0].items.push({
                            status: approvalTx ? "incomplete" : "complete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: "incomplete",
                            data: {
                                sign: order.getSignatureData(),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "zeroex-v4",
                                            data: {
                                                ...order.params,
                                            },
                                        },
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next listing
                        continue;
                    }
                    case "seaport": {
                        // Exchange-specific checks
                        if (!["reservoir", "opensea"].includes(params.orderbook)) {
                            throw Boom.badRequest("Unsupported orderbook");
                        }
                        // Make sure the fee information is correctly typed
                        if (params.fee && !Array.isArray(params.fee)) {
                            params.fee = [params.fee];
                        }
                        if (params.feeRecipient && !Array.isArray(params.feeRecipient)) {
                            params.feeRecipient = [params.feeRecipient];
                        }
                        if (((_d = params.fee) === null || _d === void 0 ? void 0 : _d.length) !== ((_e = params.feeRecipient) === null || _e === void 0 ? void 0 : _e.length)) {
                            throw Boom.badRequest("Invalid fee information");
                        }
                        const order = await seaportSellToken.build({
                            ...params,
                            maker,
                            contract,
                            tokenId,
                        });
                        if (!order) {
                            throw Boom.internal("Failed to generate order");
                        }
                        // Will be set if an approval is needed before listing
                        let approvalTx;
                        // Check the order's fillability
                        try {
                            await seaportCheck.offChainCheck(order, { onChainApprovalRecheck: true });
                        }
                        catch (error) {
                            switch (error.message) {
                                case "no-balance-no-approval":
                                case "no-balance": {
                                    // We cannot do anything if the user doesn't own the listed token
                                    throw Boom.badData("Maker does not own the listed token");
                                }
                                case "no-approval": {
                                    // Generate an approval transaction
                                    const exchange = new Sdk.Seaport.Exchange(index_1.config.chainId);
                                    const info = order.getInfo();
                                    const kind = ((_f = order.params.kind) === null || _f === void 0 ? void 0 : _f.startsWith("erc721")) ? "erc721" : "erc1155";
                                    approvalTx = (kind === "erc721"
                                        ? new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, info.contract)
                                        : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, info.contract)).approveTransaction(maker, exchange.deriveConduit(order.params.conduitKey));
                                    break;
                                }
                            }
                        }
                        steps[0].items.push({
                            status: approvalTx ? "incomplete" : "complete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: "incomplete",
                            data: {
                                sign: order.getSignatureData(),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "seaport",
                                            data: {
                                                ...order.params,
                                            },
                                        },
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next listing
                        continue;
                    }
                    case "looks-rare": {
                        // Exchange-specific checks
                        if (!["reservoir", "looks-rare"].includes(params.orderbook)) {
                            throw Boom.badRequest("Unsupported orderbook");
                        }
                        if (params.fee) {
                            throw Boom.badRequest("Exchange does not supported a custom fee");
                        }
                        const order = await looksRareSellToken.build({
                            ...params,
                            maker,
                            contract,
                            tokenId,
                        });
                        if (!order) {
                            throw Boom.internal("Failed to generate order");
                        }
                        // Will be set if an approval is needed before listing
                        let approvalTx;
                        // Check the order's fillability
                        try {
                            await looksRareCheck.offChainCheck(order, { onChainApprovalRecheck: true });
                        }
                        catch (error) {
                            switch (error.message) {
                                case "no-balance-no-approval":
                                case "no-balance": {
                                    // We cannot do anything if the user doesn't own the listed token
                                    throw Boom.badData("Maker does not own the listed token");
                                }
                                case "no-approval": {
                                    const contractKind = await commonHelpers.getContractKind(contract);
                                    if (!contractKind) {
                                        throw Boom.internal("Missing contract kind");
                                    }
                                    // Generate an approval transaction
                                    approvalTx = (contractKind === "erc721"
                                        ? new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, order.params.collection)
                                        : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, order.params.collection)).approveTransaction(maker, contractKind === "erc721"
                                        ? Sdk.LooksRare.Addresses.TransferManagerErc721[index_1.config.chainId]
                                        : Sdk.LooksRare.Addresses.TransferManagerErc1155[index_1.config.chainId]);
                                    break;
                                }
                            }
                        }
                        steps[0].items.push({
                            status: approvalTx ? "incomplete" : "complete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: "incomplete",
                            data: {
                                sign: order.getSignatureData(),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "looks-rare",
                                            data: {
                                                ...order.params,
                                            },
                                        },
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next listing
                        continue;
                    }
                    case "x2y2": {
                        if (!["x2y2"].includes(params.orderbook)) {
                            throw Boom.badRequest("Unsupported orderbook");
                        }
                        if (params.fee || params.feeRecipient) {
                            throw Boom.badRequest("X2Y2 does not supported custom fees");
                        }
                        const order = await x2y2SellToken.build({
                            ...params,
                            maker,
                            contract,
                            tokenId,
                        });
                        if (!order) {
                            throw Boom.internal("Failed to generate order");
                        }
                        // Will be set if an approval is needed before listing
                        let approvalTx;
                        // Check the order's fillability
                        const upstreamOrder = Sdk.X2Y2.Order.fromLocalOrder(index_1.config.chainId, order);
                        try {
                            await x2y2Check.offChainCheck(upstreamOrder, {
                                onChainApprovalRecheck: true,
                            });
                        }
                        catch (error) {
                            switch (error.message) {
                                case "no-balance-no-approval":
                                case "no-balance": {
                                    // We cannot do anything if the user doesn't own the listed token
                                    throw Boom.badData("Maker does not own the listed token");
                                }
                                case "no-approval": {
                                    const contractKind = await commonHelpers.getContractKind(contract);
                                    if (!contractKind) {
                                        throw Boom.internal("Missing contract kind");
                                    }
                                    // Generate an approval transaction
                                    approvalTx = new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, upstreamOrder.params.nft.token).approveTransaction(maker, Sdk.X2Y2.Addresses.Erc721Delegate[index_1.config.chainId]);
                                    break;
                                }
                            }
                        }
                        steps[0].items.push({
                            status: approvalTx ? "incomplete" : "complete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: "incomplete",
                            data: {
                                sign: new Sdk.X2Y2.Exchange(index_1.config.chainId, index_1.config.x2y2ApiKey).getOrderSignatureData(order),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "x2y2",
                                            data: {
                                                ...order,
                                            },
                                        },
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                    }
                }
            }
            // De-duplicate step items
            for (const step of steps) {
                // Assume `JSON.stringify` is deterministic
                const uniqueItems = lodash_1.default.uniqBy(step.items, ({ data }) => JSON.stringify(data));
                if (step.items.length > uniqueItems.length) {
                    step.items = uniqueItems.map((item) => ({
                        status: item.status,
                        data: item.data,
                        orderIndex: item.orderIndex,
                    }));
                }
            }
            return { steps };
        }
        catch (error) {
            logger_1.logger.error(`get-execute-list-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v3.js.map