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
exports.getExecuteListV2Options = void 0;
const constants_1 = require("@ethersproject/constants");
const bytes_1 = require("@ethersproject/bytes");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
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
const version = "v2";
exports.getExecuteListV2Options = {
    description: "Create ask (listing)",
    notes: "Generate a listing and submit it to multiple marketplaces",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            token: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .required()
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            quantity: joi_1.default.number().description("Quanity of tokens user is listing. Only compatible with ERC1155 tokens. Example: `5`"),
            maker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Address of wallet making the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
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
            source: joi_1.default.string().description("Name of the platform that created the order. Example: `Chimpers Market`"),
            automatedRoyalties: joi_1.default.boolean()
                .default(true)
                .description("If true, royalties will be automatically included."),
            fee: joi_1.default.alternatives(joi_1.default.string().pattern(utils_1.regex.number), joi_1.default.number(), joi_1.default.array().items(joi_1.default.string().pattern(utils_1.regex.number)), joi_1.default.array().items(joi_1.default.number()).description("Fee amount in BPS. Example: `100`")),
            feeRecipient: joi_1.default.alternatives(joi_1.default.string().lowercase().pattern(utils_1.regex.address).disallow(constants_1.AddressZero), joi_1.default.array()
                .items(joi_1.default.string().lowercase().pattern(utils_1.regex.address).disallow(constants_1.AddressZero))
                .description("Wallet address of fee recipient. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`")),
            listingTime: joi_1.default.alternatives(joi_1.default.string().pattern(utils_1.regex.number), joi_1.default.number()).description("Unix timestamp indicating when listing will be listed. Example: `1656080318`"),
            expirationTime: joi_1.default.string()
                .pattern(utils_1.regex.unixTimestamp)
                .description("Unix timestamp (seconds) indicating when listing will expire. Example: `1656080318`"),
            salt: joi_1.default.string()
                .pattern(/^\d+$/)
                .description("Optional. Random string to make the order unique"),
            nonce: joi_1.default.string().pattern(utils_1.regex.number).description("Optional. Set a custom nonce"),
            v: joi_1.default.number().description("Signature v component (only required after order has been signed)"),
            r: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.bytes32)
                .description("Signature r component (only required after order has been signed)"),
            s: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.bytes32)
                .description("Signature s component (only required after order has been signed)"),
        })
            .with("feeRecipient", "fee")
            .with("fee", "feeRecipient"),
    },
    response: {
        schema: joi_1.default.object({
            steps: joi_1.default.array().items(joi_1.default.object({
                action: joi_1.default.string().required(),
                description: joi_1.default.string().required(),
                status: joi_1.default.string().valid("complete", "incomplete").required(),
                kind: joi_1.default.string().valid("request", "signature", "transaction").required(),
                data: joi_1.default.object(),
            })),
            query: joi_1.default.object(),
        }).label(`getExecuteList${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-list-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b, _c, _d, _e, _f;
        const query = request.query;
        try {
            const [contract, tokenId] = query.token.split(":");
            // Set up generic listing steps
            const steps = [
                {
                    action: "Approve NFT contract",
                    description: "Each NFT collection you want to trade requires a one-time approval transaction",
                    kind: "transaction",
                },
                {
                    action: "Authorize listing",
                    description: "A free off-chain signature to create the listing",
                    kind: "signature",
                },
                {
                    action: "Submit listing",
                    description: "Post your listing to the order book for others to discover it",
                    kind: "request",
                },
            ];
            switch (query.orderKind) {
                case "zeroex-v4": {
                    // Exchange-specific checks
                    if (!["reservoir"].includes(query.orderbook)) {
                        throw Boom.badRequest("Unsupported orderbook");
                    }
                    // Make sure the fee information is correctly types
                    if (query.fee && !Array.isArray(query.fee)) {
                        query.fee = [query.fee];
                    }
                    if (query.feeRecipient && !Array.isArray(query.feeRecipient)) {
                        query.feeRecipient = [query.feeRecipient];
                    }
                    if (((_a = query.fee) === null || _a === void 0 ? void 0 : _a.length) !== ((_b = query.feeRecipient) === null || _b === void 0 ? void 0 : _b.length)) {
                        throw Boom.badRequest("Invalid fee information");
                    }
                    const order = await zeroExV4SellToken.build({
                        ...query,
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
                                    : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, order.params.nft)).approveTransaction(query.maker, Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId]);
                                break;
                            }
                        }
                    }
                    const hasSignature = query.v && query.r && query.s;
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: approvalTx ? "incomplete" : "complete",
                                data: approvalTx,
                            },
                            {
                                ...steps[1],
                                status: hasSignature ? "complete" : "incomplete",
                                data: hasSignature ? undefined : order.getSignatureData(),
                            },
                            {
                                ...steps[2],
                                status: "incomplete",
                                data: !hasSignature
                                    ? undefined
                                    : {
                                        endpoint: "/order/v2",
                                        method: "POST",
                                        body: {
                                            order: {
                                                kind: "zeroex-v4",
                                                data: {
                                                    ...order.params,
                                                    v: query.v,
                                                    r: query.r,
                                                    s: query.s,
                                                },
                                            },
                                            orderbook: query.orderbook,
                                            source: query.source,
                                        },
                                    },
                            },
                        ],
                        query: {
                            ...query,
                            expirationTime: order.params.expiry,
                            nonce: order.params.nonce,
                        },
                    };
                }
                case "seaport": {
                    // Exchange-specific checks
                    if (!["reservoir", "opensea"].includes(query.orderbook)) {
                        throw Boom.badRequest("Unsupported orderbook");
                    }
                    // Make sure the fee information is correctly typed
                    if (query.fee && !Array.isArray(query.fee)) {
                        query.fee = [query.fee];
                    }
                    if (query.feeRecipient && !Array.isArray(query.feeRecipient)) {
                        query.feeRecipient = [query.feeRecipient];
                    }
                    if (((_d = query.fee) === null || _d === void 0 ? void 0 : _d.length) !== ((_e = query.feeRecipient) === null || _e === void 0 ? void 0 : _e.length)) {
                        throw Boom.badRequest("Invalid fee information");
                    }
                    const order = await seaportSellToken.build({
                        ...query,
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
                                    : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, info.contract)).approveTransaction(query.maker, exchange.deriveConduit(order.params.conduitKey));
                                break;
                            }
                        }
                    }
                    const hasSignature = query.v && query.r && query.s;
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: approvalTx ? "incomplete" : "complete",
                                data: approvalTx,
                            },
                            {
                                ...steps[1],
                                status: hasSignature ? "complete" : "incomplete",
                                data: hasSignature ? undefined : order.getSignatureData(),
                            },
                            {
                                ...steps[2],
                                status: "incomplete",
                                data: !hasSignature
                                    ? undefined
                                    : {
                                        endpoint: "/order/v2",
                                        method: "POST",
                                        body: {
                                            order: {
                                                kind: "seaport",
                                                data: {
                                                    ...order.params,
                                                    // Seaport takes the joined signature
                                                    signature: (0, bytes_1.joinSignature)({ v: query.v, r: query.r, s: query.s }),
                                                },
                                            },
                                            orderbook: query.orderbook,
                                            source: query.source,
                                        },
                                    },
                            },
                        ],
                        query: {
                            ...query,
                            listingTime: order.params.startTime,
                            expirationTime: order.params.endTime,
                            salt: order.params.salt,
                            nonce: order.params.counter,
                        },
                    };
                }
                case "looks-rare": {
                    if (!["reservoir", "looks-rare"].includes(query.orderbook)) {
                        throw Boom.badRequest("Unsupported orderbook");
                    }
                    if (query.fee) {
                        throw Boom.badRequest("LooksRare does not supported custom fees");
                    }
                    const order = await looksRareSellToken.build({
                        ...query,
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
                                    : new Sdk.Common.Helpers.Erc1155(provider_1.baseProvider, order.params.collection)).approveTransaction(query.maker, contractKind === "erc721"
                                    ? Sdk.LooksRare.Addresses.TransferManagerErc721[index_1.config.chainId]
                                    : Sdk.LooksRare.Addresses.TransferManagerErc1155[index_1.config.chainId]);
                                break;
                            }
                        }
                    }
                    const hasSignature = query.v && query.r && query.s;
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: approvalTx ? "incomplete" : "complete",
                                data: approvalTx,
                            },
                            {
                                ...steps[1],
                                status: hasSignature ? "complete" : "incomplete",
                                data: hasSignature ? undefined : order.getSignatureData(),
                            },
                            {
                                ...steps[2],
                                status: "incomplete",
                                data: !hasSignature
                                    ? undefined
                                    : {
                                        endpoint: "/order/v2",
                                        method: "POST",
                                        body: {
                                            order: {
                                                kind: "looks-rare",
                                                data: {
                                                    ...order.params,
                                                    v: query.v,
                                                    r: query.r,
                                                    s: query.s,
                                                },
                                            },
                                            orderbook: query.orderbook,
                                            source: query.source,
                                        },
                                    },
                            },
                        ],
                        query: {
                            ...query,
                            listingTime: order.params.startTime,
                            expirationTime: order.params.endTime,
                            nonce: order.params.nonce,
                        },
                    };
                }
                case "x2y2": {
                    if (!["x2y2"].includes(query.orderbook)) {
                        throw Boom.badRequest("Unsupported orderbook");
                    }
                    if (query.fee || query.feeRecipient) {
                        throw Boom.badRequest("X2Y2 does not supported custom fees");
                    }
                    const order = await x2y2SellToken.build({
                        ...query,
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
                                approvalTx = new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, upstreamOrder.params.nft.token).approveTransaction(query.maker, Sdk.X2Y2.Addresses.Erc721Delegate[index_1.config.chainId]);
                                break;
                            }
                        }
                    }
                    const hasSignature = query.v && query.r && query.s;
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: approvalTx ? "incomplete" : "complete",
                                data: approvalTx,
                            },
                            {
                                ...steps[1],
                                status: hasSignature ? "complete" : "incomplete",
                                data: hasSignature
                                    ? undefined
                                    : new Sdk.X2Y2.Exchange(index_1.config.chainId, index_1.config.x2y2ApiKey).getOrderSignatureData(order),
                            },
                            {
                                ...steps[2],
                                status: "incomplete",
                                data: !hasSignature
                                    ? undefined
                                    : {
                                        endpoint: "/order/v2",
                                        method: "POST",
                                        body: {
                                            order: {
                                                kind: "x2y2",
                                                data: {
                                                    ...order,
                                                    v: query.v,
                                                    r: query.r,
                                                    s: query.s,
                                                },
                                            },
                                            orderbook: query.orderbook,
                                            source: query.source,
                                        },
                                    },
                            },
                        ],
                        query: {
                            ...query,
                            expirationTime: order.deadline,
                            salt: order.salt,
                        },
                    };
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`get-execute-list-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map