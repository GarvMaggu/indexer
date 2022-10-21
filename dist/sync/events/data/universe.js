"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancel = exports.match = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.match = {
    kind: "universe-match",
    addresses: { [(_a = sdk_1.Universe.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x268820db288a211986b26a8fda86b1e0046281b21206936bb0e61c67b5c79ef4",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event Match(
      bytes32 indexed leftHash,
      bytes32 indexed rightHash,
      address indexed leftMaker,
      address rightMaker,
      uint256 newLeftFill,
      uint256 newRightFill,
      (bytes4 assetClass, bytes data) leftAsset,
      (bytes4 assetClass, bytes data) rightAsset
    )`,
    ]),
};
exports.cancel = {
    kind: "universe-cancel",
    addresses: { [(_b = sdk_1.Universe.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0xbbdc98cb2835f4f846e6a63700d0498b4674f0e8858fd50c6379314227afa04e",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event Cancel(
      bytes32 indexed hash,
      address indexed maker,
      (bytes4 assetClass, bytes data) makeAssetType,
      (bytes4 assetClass, bytes data) takeAssetType
    )`,
    ]),
};
//# sourceMappingURL=universe.js.map