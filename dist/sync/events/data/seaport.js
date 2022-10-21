"use strict";
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.counterIncremented = exports.orderFulfilled = exports.orderCancelled = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.orderCancelled = {
    kind: "seaport-order-cancelled",
    addresses: { [(_a = sdk_1.Seaport.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x6bacc01dbe442496068f7d234edd811f1a5f833243e0aec824f86ab861f3c90d",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event OrderCancelled(
      bytes32 orderHash,
      address indexed offerer,
      address indexed zone
    )`,
    ]),
};
exports.orderFulfilled = {
    kind: "seaport-order-filled",
    addresses: { [(_b = sdk_1.Seaport.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0x9d9af8e38d66c62e2c12f0225249fd9d721c54b83f48d9352c97c6cacdcb6f31",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event OrderFulfilled(
      bytes32 orderHash,
      address indexed offerer,
      address indexed zone,
      address recipient,
      (
        uint8 itemType,
        address token,
        uint256 identifier,
        uint256 amount
      )[] offer,
      (
        uint8 itemType,
        address token,
        uint256 identifier,
        uint256 amount,
        address recipient
      )[] consideration
    )`,
    ]),
};
exports.counterIncremented = {
    kind: "seaport-counter-incremented",
    addresses: { [(_c = sdk_1.Seaport.Addresses.Exchange[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0x721c20121297512b72821b97f5326877ea8ecf4bb9948fea5bfcb6453074d37f",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event CounterIncremented(
      uint256 newCounter,
      address indexed offerer
    )`,
    ]),
};
//# sourceMappingURL=seaport.js.map