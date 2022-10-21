"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.takerBid = exports.takerAsk = exports.cancelMultipleOrders = exports.cancelAllOrders = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.cancelAllOrders = {
    kind: "looks-rare-cancel-all-orders",
    addresses: { [(_a = sdk_1.LooksRare.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x1e7178d84f0b0825c65795cd62e7972809ad3aac6917843aaec596161b2c0a97",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event CancelAllOrders(
      address indexed user,
      uint256 newMinNonce
    )`,
    ]),
};
exports.cancelMultipleOrders = {
    kind: "looks-rare-cancel-multiple-orders",
    addresses: { [(_b = sdk_1.LooksRare.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0xfa0ae5d80fe3763c880a3839fab0294171a6f730d1f82c4cd5392c6f67b41732",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event CancelMultipleOrders(
      address indexed user,
      uint256[] orderNonces
    )`,
    ]),
};
exports.takerAsk = {
    kind: "looks-rare-taker-ask",
    addresses: { [(_c = sdk_1.LooksRare.Addresses.Exchange[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0x68cd251d4d267c6e2034ff0088b990352b97b2002c0476587d0c4da889c11330",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event TakerAsk(
      bytes32 orderHash,
      uint256 orderNonce,
      address indexed taker,
      address indexed maker,
      address indexed strategy,
      address currency,
      address collection,
      uint256 tokenId,
      uint256 amount,
      uint256 price
    )`,
    ]),
};
exports.takerBid = {
    kind: "looks-rare-taker-bid",
    addresses: { [(_d = sdk_1.LooksRare.Addresses.Exchange[index_1.config.chainId]) === null || _d === void 0 ? void 0 : _d.toLowerCase()]: true },
    topic: "0x95fb6205e23ff6bda16a2d1dba56b9ad7c783f67c96fa149785052f47696f2be",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event TakerBid(
      bytes32 orderHash,
      uint256 orderNonce,
      address indexed taker,
      address indexed maker,
      address indexed strategy,
      address currency,
      address collection,
      uint256 tokenId,
      uint256 amount,
      uint256 price
    )`,
    ]),
};
//# sourceMappingURL=looks-rare.js.map