"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderFulfilled = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.orderFulfilled = {
    kind: "quixotic-order-filled",
    addresses: { [(_a = sdk_1.Quixotic.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
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
//# sourceMappingURL=quixotic.js.map