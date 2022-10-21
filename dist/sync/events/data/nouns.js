"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.auctionSettled = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.auctionSettled = {
    kind: "nouns-auction-settled",
    addresses: { [(_a = sdk_1.Nouns.Addresses.AuctionHouse[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0xc9f72b276a388619c6d185d146697036241880c36654b1a3ffdad07c24038d99",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event AuctionSettled(
      uint256 indexed nounId,
      address winner,
      uint256 amount
    )`,
    ]),
};
//# sourceMappingURL=nouns.js.map