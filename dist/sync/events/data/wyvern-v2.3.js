"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersMatched = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.ordersMatched = {
    kind: "wyvern-v2.3-orders-matched",
    addresses: { [(_a = sdk_1.WyvernV23.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0xc4109843e0b7d514e4c093114b863f8e7d8d9a458c372cd51bfe526b588006c9",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event OrdersMatched(
      bytes32 buyHash,
      bytes32 sellHash,
      address indexed maker,
      address indexed taker,
      uint256 price,
      bytes32 indexed metadata
    )`,
    ]),
};
//# sourceMappingURL=wyvern-v2.3.js.map