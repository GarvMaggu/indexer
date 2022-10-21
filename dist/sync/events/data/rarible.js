"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.match = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.match = {
    kind: "rarible-match",
    addresses: { [(_a = sdk_1.Rarible.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x268820db288a211986b26a8fda86b1e0046281b21206936bb0e61c67b5c79ef4",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event Match(
      bytes32 leftHash,
      bytes32 rightHash,
      address leftMaker,
      address rightMaker,
      uint256 newLeftFill,
      uint256 newRightFill,
      (bytes4 assetClass, bytes data) leftAsset,
      (bytes4 assetClass, bytes data) rightAsset
    )`,
    ]),
};
//# sourceMappingURL=rarible.js.map