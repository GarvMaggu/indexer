"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBuildInfo = void 0;
const db_1 = require("@/common/db");
const types_1 = require("@reservoir0x/sdk/dist/universe/types");
const getBuildInfo = async (options, collection, side) => {
    const collectionResult = await db_1.redb.oneOrNone(`
      SELECT
        contracts.kind,
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
    if (collectionResult.kind !== "erc721" && collectionResult.kind !== "erc1155") {
        throw new Error("Invalid NFT asset class");
    }
    const params = {
        maker: options.maker,
        side: side === types_1.OrderSide.BUY ? "buy" : "sell",
        tokenKind: collectionResult.kind,
        contract: options.contract,
        tokenId: options.tokenId,
        tokenAmount: options.quantity,
        price: options.weiPrice,
        paymentToken: options.currency,
        fees: options.fees,
        startTime: options.listingTime,
        endTime: options.expirationTime,
    };
    return {
        params,
    };
};
exports.getBuildInfo = getBuildInfo;
//# sourceMappingURL=utils.js.map