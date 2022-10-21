"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyPriceAccepted = exports.buyPriceCancelled = exports.buyPriceInvalidated = exports.buyPriceSet = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.buyPriceSet = {
    kind: "foundation-buy-price-set",
    addresses: { [(_a = sdk_1.Foundation.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0xfcc77ea8bdcce862f43b7fb00fe6b0eb90d6aeead27d3800d9257cf7a05f9d96",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event BuyPriceSet(
      address indexed nftContract,
      uint256 indexed tokenId,
      address indexed seller,
      uint256 price
    )`,
    ]),
};
exports.buyPriceInvalidated = {
    kind: "foundation-buy-price-invalidated",
    addresses: { [(_b = sdk_1.Foundation.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0xaa6271d89a385571e237d3e7254ccc7c09f68055e6e9b410ed08233a8b9a05cf",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event BuyPriceInvalidated(
      address indexed nftContract,
      uint256 indexed tokenId
    )`,
    ]),
};
exports.buyPriceCancelled = {
    kind: "foundation-buy-price-cancelled",
    addresses: { [(_c = sdk_1.Foundation.Addresses.Exchange[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0x70c7877531c04c7d9caa8a7eca127384f04e8a6ee58b63f778ce5401d8bcae41",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event BuyPriceCanceled(
      address indexed nftContract,
      uint256 indexed tokenId
    )`,
    ]),
};
exports.buyPriceAccepted = {
    kind: "foundation-buy-price-accepted",
    addresses: { [(_d = sdk_1.Foundation.Addresses.Exchange[index_1.config.chainId]) === null || _d === void 0 ? void 0 : _d.toLowerCase()]: true },
    topic: "0xd28c0a7dd63bc853a4e36306655da9f8c0b29ff9d0605bb976ae420e46a99930",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event BuyPriceAccepted(
      address indexed nftContract,
      uint256 indexed tokenId,
      address indexed seller,
      address buyer,
      uint256 protocolFee,
      uint256 creatorFee,
      uint256 sellerRev
    )`,
    ]),
};
//# sourceMappingURL=foundation.js.map