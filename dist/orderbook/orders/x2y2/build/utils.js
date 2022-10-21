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
        contracts.address,
        contracts.kind
      FROM collections
      JOIN contracts
        ON collections.contract = contracts.address
      WHERE collections.id = $/collection/
      LIMIT 1
    `, { collection });
    if (!collectionResult) {
        throw new Error("Could not fetch collection");
    }
    if (collectionResult.kind !== "erc721") {
        throw new Error("X2Y2 only supports ERC721 orders");
    }
    const buildParams = {
        user: options.maker,
        network: index_1.config.chainId,
        side,
        contract: (0, utils_1.fromBuffer)(collectionResult.address),
        price: options.weiPrice,
        currency: side === "buy"
            ? Sdk.Common.Addresses.Weth[index_1.config.chainId]
            : Sdk.Common.Addresses.Eth[index_1.config.chainId],
        deadline: options.expirationTime || (0, utils_1.now)() + 24 * 3600,
        salt: (_a = options.salt) === null || _a === void 0 ? void 0 : _a.toString(),
    };
    return {
        params: buildParams,
    };
};
exports.getBuildInfo = getBuildInfo;
//# sourceMappingURL=utils.js.map