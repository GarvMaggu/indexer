"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersMatched = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.ordersMatched = {
    kind: "blur-orders-matched",
    addresses: { [(_a = sdk_1.Blur.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x61cbb2a3dee0b6064c2e681aadd61677fb4ef319f0b547508d495626f5a62f64",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event OrdersMatched(
      address indexed maker,
      address indexed taker,
      (
        address trader,
        uint8 side,
        address matchingPolicy,
        address collection,
        uint256 tokenId,
        uint256 amount,
        address paymentToken,
        uint256 price,
        uint256 listingTime,
        uint256 expirationTime,
        (
          uint16 rate,
          address recipient
        )[] fees,
        uint256 salt,
        bytes extraParams
      ) sell,
      bytes32 sellHash,
      (
        address trader,
        uint8 side,
        address matchingPolicy,
        address collection,
        uint256 tokenId,
        uint256 amount,
        address paymentToken,
        uint256 price,
        uint256 listingTime,
        uint256 expirationTime,
        (
          uint16 rate,
          address recipient
        )[] fees,
        uint256 salt,
        bytes extraParams
      ) buy,
      bytes32 buyHash
    )`,
    ]),
};
//# sourceMappingURL=blur.js.map