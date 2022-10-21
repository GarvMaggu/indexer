"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderInventory = exports.orderCancelled = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.orderCancelled = {
    kind: "x2y2-order-cancelled",
    addresses: { [(_a = sdk_1.X2Y2.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x5b0b06d07e20243724d90e17a20034972f339eb28bd1c9437a71999bd15a1e7a",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event EvCancel(
      bytes32 indexed itemHash
    )`,
    ]),
};
exports.orderInventory = {
    kind: "x2y2-order-inventory",
    addresses: { [(_b = sdk_1.X2Y2.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0x3cbb63f144840e5b1b0a38a7c19211d2e89de4d7c5faf8b2d3c1776c302d1d33",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event EvInventory(
      bytes32 indexed itemHash,
      address maker,
      address taker,
      uint256 orderSalt,
      uint256 settleSalt,
      uint256 intent,
      uint256 delegateType,
      uint256 deadline,
      address currency,
      bytes dataMask,
      (uint256 price, bytes data) item,
      (
        uint8 op,
        uint256 orderIdx,
        uint256 itemIdx,
        uint256 price,
        bytes32 itemHash,
        address executionDelegate,
        bytes dataReplacement,
        uint256 bidIncentivePct,
        uint256 aucMinIncrementPct,
        uint256 aucIncDurationSecs,
        (uint256 percentage, address to)[] fees
      ) detail
    )`,
    ]),
};
//# sourceMappingURL=x2y2.js.map