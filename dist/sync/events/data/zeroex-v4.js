"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.erc1155OrderFilled = exports.erc721OrderFilled = exports.erc1155OrderCancelled = exports.erc721OrderCancelled = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.erc721OrderCancelled = {
    kind: "zeroex-v4-erc721-order-cancelled",
    addresses: { [(_a = sdk_1.ZeroExV4.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0xa015ad2dc32f266993958a0fd9884c746b971b254206f3478bc43e2f125c7b9e",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC721OrderCancelled(
      address maker,
      uint256 nonce
    )`,
    ]),
};
exports.erc1155OrderCancelled = {
    kind: "zeroex-v4-erc1155-order-cancelled",
    addresses: { [(_b = sdk_1.ZeroExV4.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0x4d5ea7da64f50a4a329921b8d2cab52dff4ebcc58b61d10ff839e28e91445684",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC1155OrderCancelled(
      address maker,
      uint256 nonce
    )`,
    ]),
};
exports.erc721OrderFilled = {
    kind: "zeroex-v4-erc721-order-filled",
    addresses: { [(_c = sdk_1.ZeroExV4.Addresses.Exchange[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0x50273fa02273cceea9cf085b42de5c8af60624140168bd71357db833535877af",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC721OrderFilled(
      uint8 direction,
      address maker,
      address taker,
      uint256 nonce,
      address erc20Token,
      uint256 erc20TokenAmount,
      address erc721Token,
      uint256 erc721TokenId,
      address matcher
    )`,
    ]),
};
exports.erc1155OrderFilled = {
    kind: "zeroex-v4-erc1155-order-filled",
    addresses: { [(_d = sdk_1.ZeroExV4.Addresses.Exchange[index_1.config.chainId]) === null || _d === void 0 ? void 0 : _d.toLowerCase()]: true },
    topic: "0x20cca81b0e269b265b3229d6b537da91ef475ca0ef55caed7dd30731700ba98d",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC1155OrderFilled(
      uint8 direction,
      address maker,
      address taker,
      uint256 nonce,
      address erc20Token,
      uint256 erc20FillAmount,
      address erc1155Token,
      uint256 erc1155TokenId,
      uint128 erc1155FillAmount,
      address matcher
    )`,
    ]),
};
//# sourceMappingURL=zeroex-v4.js.map