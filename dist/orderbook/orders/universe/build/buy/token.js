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
exports.build = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils = __importStar(require("@/orderbook/orders/universe/build/utils"));
const build = async (options) => {
    try {
        const collectionResult = await db_1.redb.oneOrNone(`
        SELECT
          tokens.collection_id
        FROM tokens
        WHERE tokens.contract = $/contract/
          AND tokens.token_id = $/tokenId/
      `, {
            contract: (0, utils_1.toBuffer)(options.contract),
            tokenId: options.tokenId,
        });
        if (!collectionResult) {
            // Skip if we cannot retrieve the token's collection.
            return undefined;
        }
        const buildInfo = await utils.getBuildInfo(options, collectionResult.collection_id, Sdk.Universe.Types.OrderSide.BUY);
        if (!buildInfo) {
            // Skip if we cannot generate the build information.
            return undefined;
        }
        const builder = new Sdk.Universe.Builders.SingleToken(index_1.config.chainId);
        return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
    }
    catch (error) {
        logger_1.logger.error("universe-build-buy-token-order", `Failed to build order: ${error}`);
        return undefined;
    }
};
exports.build = build;
//# sourceMappingURL=token.js.map