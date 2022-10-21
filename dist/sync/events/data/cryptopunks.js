"use strict";
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
exports.assign = exports.transfer = exports.punkTransfer = exports.punkBought = exports.punkNoLongerForSale = exports.punkOffered = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.punkOffered = {
    kind: "cryptopunks-punk-offered",
    addresses: { [(_a = sdk_1.CryptoPunks.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x3c7b682d5da98001a9b8cbda6c647d2c63d698a4184fd1d55e2ce7b66f5d21eb",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event PunkOffered(
      uint256 indexed punkIndex,
      uint256 minValue,
      address indexed toAddress
    )`,
    ]),
};
exports.punkNoLongerForSale = {
    kind: "cryptopunks-punk-no-longer-for-sale",
    addresses: { [(_b = sdk_1.CryptoPunks.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0xb0e0a660b4e50f26f0b7ce75c24655fc76cc66e3334a54ff410277229fa10bd4",
    numTopics: 2,
    abi: new abi_1.Interface([`event PunkNoLongerForSale(uint256 indexed punkIndex)`]),
};
exports.punkBought = {
    kind: "cryptopunks-punk-bought",
    addresses: { [(_c = sdk_1.CryptoPunks.Addresses.Exchange[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0x58e5d5a525e3b40bc15abaa38b5882678db1ee68befd2f60bafe3a7fd06db9e3",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event PunkBought(
      uint256 indexed punkIndex,
      uint256 value,
      address indexed fromAddress,
      address indexed toAddress
    )`,
    ]),
};
exports.punkTransfer = {
    kind: "cryptopunks-punk-transfer",
    addresses: { [(_d = sdk_1.CryptoPunks.Addresses.Exchange[index_1.config.chainId]) === null || _d === void 0 ? void 0 : _d.toLowerCase()]: true },
    topic: "0x05af636b70da6819000c49f85b21fa82081c632069bb626f30932034099107d8",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event PunkTransfer(
      address indexed from,
      address indexed to,
      uint256 punkIndex
    )`,
    ]),
};
exports.transfer = {
    kind: "cryptopunks-transfer",
    addresses: { [(_e = sdk_1.CryptoPunks.Addresses.Exchange[index_1.config.chainId]) === null || _e === void 0 ? void 0 : _e.toLowerCase()]: true },
    topic: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event Transfer(
      address indexed from,
      address indexed to,
      uint256 value
    )`,
    ]),
};
exports.assign = {
    kind: "cryptopunks-assign",
    addresses: { [(_f = sdk_1.CryptoPunks.Addresses.Exchange[index_1.config.chainId]) === null || _f === void 0 ? void 0 : _f.toLowerCase()]: true },
    topic: "0x8a0e37b73a0d9c82e205d4d1a3ff3d0b57ce5f4d7bccf6bac03336dc101cb7ba",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event Assign(
      address indexed to,
      uint256 punkIndex
    )`,
    ]),
};
//# sourceMappingURL=cryptopunks.js.map