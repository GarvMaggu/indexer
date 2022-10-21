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
const Sdk = __importStar(require("@reservoir0x/sdk"));
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const getBuildInfo = async (options, collection, side) => {
    var _a;
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
    const buildParams = {
        direction: side,
        contract: options.contract,
        maker: options.maker,
        paymentToken: side === "sell"
            ? Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]
            : Sdk.Common.Addresses.Weth[index_1.config.chainId],
        price: options.weiPrice,
        fees: [],
        amount: collectionResult.kind === "erc1155" ? (_a = options.quantity) !== null && _a !== void 0 ? _a : "1" : undefined,
        expiry: Number(options.expirationTime) === 0 ? undefined : options.expirationTime,
        nonce: options.nonce,
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
    if (options.fee && options.feeRecipient) {
        for (let i = 0; i < options.fee.length; i++) {
            const fee = (0, utils_1.bn)(options.fee[i]).mul(options.weiPrice).div(10000).toString();
            buildParams.fees.push({
                recipient: options.feeRecipient[i],
                amount: fee,
            });
            totalFees = totalFees.add(fee);
        }
    }
    buildParams.price = (0, utils_1.bn)(buildParams.price).sub(totalFees);
    return {
        params: buildParams,
        kind: collectionResult.kind,
    };
};
exports.getBuildInfo = getBuildInfo;
//# sourceMappingURL=utils.js.map