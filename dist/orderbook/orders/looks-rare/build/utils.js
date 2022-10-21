"use strict";
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
exports.getBuildInfo = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const axios_1 = __importDefault(require("axios"));
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const getBuildInfo = async (options, collection, side) => {
    const collectionResult = await db_1.redb.oneOrNone(`
      SELECT
        contracts.address
      FROM collections
      JOIN contracts
        ON collections.contract = contracts.address
      WHERE collections.id = $/collection/
      LIMIT 1
    `, { collection });
    if (!collectionResult) {
        // Skip if we cannot retrieve the collection
        throw new Error("Could not fetch token collection");
    }
    const buildParams = {
        isOrderAsk: side === "sell",
        collection: (0, utils_1.fromBuffer)(collectionResult.address),
        signer: options.maker,
        price: options.weiPrice,
        // LooksRare uses WETH instead of ETH for sell orders too
        currency: Sdk.Common.Addresses.Weth[index_1.config.chainId],
        // TODO: We should only use LooksRare's nonce when cross-posting to their orderbook
        nonce: await axios_1.default
            .get(`https://${index_1.config.chainId === 5 ? "api-goerli." : "api."}looksrare.org/api/v1/orders/nonce?address=${options.maker}`, {
            headers: index_1.config.chainId === 1
                ? {
                    "Content-Type": "application/json",
                    "X-Looks-Api-Key": index_1.config.looksRareApiKey,
                }
                : {
                    "Content-Type": "application/json",
                },
        })
            .then(({ data }) => data.data),
        startTime: options.listingTime,
        endTime: options.expirationTime,
    };
    return {
        params: buildParams,
    };
};
exports.getBuildInfo = getBuildInfo;
//# sourceMappingURL=utils.js.map