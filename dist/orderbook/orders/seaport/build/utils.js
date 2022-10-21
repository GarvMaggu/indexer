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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBuildInfo = void 0;
const constants_1 = require("@ethersproject/constants");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const db_1 = require("@/common/db");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const getBuildInfo = async (options, collection, side) => {
    var _a, _b;
    const collectionResult = await db_1.redb.oneOrNone(`
      SELECT
        contracts.kind,
        collections.royalties
      FROM collections
      JOIN contracts
        ON collections.contract = contracts.address
      WHERE collections.id = $/collection/
      LIMIT 1
    `, { collection });
    if (!collectionResult) {
        throw new Error("Could not fetch collection");
    }
    const exchange = new Sdk.Seaport.Exchange(index_1.config.chainId);
    const buildParams = {
        offerer: options.maker,
        side,
        tokenKind: collectionResult.kind,
        contract: options.contract,
        price: options.weiPrice,
        paymentToken: options.currency
            ? options.currency
            : side === "buy"
                ? Sdk.Common.Addresses.Weth[index_1.config.chainId]
                : Sdk.Common.Addresses.Eth[index_1.config.chainId],
        fees: [],
        // Use OpenSea's pausable zone when posting to OpenSea
        zone: options.orderbook === "opensea"
            ? (_a = Sdk.Seaport.Addresses.PausableZone[index_1.config.chainId]) !== null && _a !== void 0 ? _a : constants_1.AddressZero
            : constants_1.AddressZero,
        // Use OpenSea's conduit for sharing approvals (where available)
        conduitKey: (_b = Sdk.Seaport.Addresses.OpenseaConduitKey[index_1.config.chainId]) !== null && _b !== void 0 ? _b : constants_1.HashZero,
        startTime: options.listingTime || (0, utils_1.now)() - 1 * 60,
        endTime: options.expirationTime || (0, utils_1.now)() + 6 * 30 * 24 * 3600,
        salt: options.salt,
        counter: (await exchange.getCounter(provider_1.baseProvider, options.maker)).toString(),
    };
    // Keep track of the total amount of fees
    let totalFees = (0, utils_1.bn)(0);
    if (options.automatedRoyalties) {
        // Include the royalties
        for (const { recipient, bps } of collectionResult.royalties || []) {
            if (recipient && Number(bps) > 0) {
                const fee = (0, utils_1.bn)(bps).mul(options.weiPrice).div(10000).toString();
                buildParams.fees.push({
                    recipient,
                    amount: fee,
                });
                totalFees = totalFees.add(fee);
            }
        }
    }
    if (options.orderbook === "opensea") {
        if (!options.fee || !options.feeRecipient) {
            options.fee = [];
            options.feeRecipient = [];
        }
        options.fee.push(250);
        // OpenSea's Seaport fee recipient
        options.feeRecipient.push("0x0000a26b00c1f0df003000390027140000faa719");
    }
    if (options.fee && options.feeRecipient) {
        for (let i = 0; i < options.fee.length; i++) {
            if (Number(options.fee[i]) > 0) {
                const fee = (0, utils_1.bn)(options.fee[i]).mul(options.weiPrice).div(10000).toString();
                buildParams.fees.push({
                    recipient: options.feeRecipient[i],
                    amount: fee,
                });
                totalFees = totalFees.add(fee);
            }
        }
    }
    // If the order is a listing, subtract the fees from the price.
    // Otherwise, keep them (since the taker will pay them from the
    // amount received from the maker).
    if (side === "sell") {
        buildParams.price = (0, utils_1.bn)(buildParams.price).sub(totalFees);
    }
    else {
        buildParams.price = (0, utils_1.bn)(buildParams.price);
    }
    return {
        params: buildParams,
        kind: collectionResult.kind,
    };
};
exports.getBuildInfo = getBuildInfo;
//# sourceMappingURL=utils.js.map