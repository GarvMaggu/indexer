"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.erc1155BuyOrderFilled = exports.erc1155SellOrderFilled = exports.erc721BuyOrderFilled = exports.erc721SellOrderFilled = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.erc721SellOrderFilled = {
    kind: "element-erc721-sell-order-filled",
    addresses: { [(_a = sdk_1.Element.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x8a0f8e04e7a35efabdc150b7d106308198a4f965a5d11badf768c5b8b273ac94",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC721SellOrderFilled(
      address maker,
      address taker,
      address erc20Token,
      uint256 erc20TokenAmount,
      address erc721Token,
      uint256 erc721TokenId,
      bytes32 orderHash
    )`,
    ]),
};
exports.erc721BuyOrderFilled = {
    kind: "element-erc721-buy-order-filled",
    addresses: { [(_b = sdk_1.Element.Addresses.Exchange[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0xa24193d56ccdf64ce1df60c80ca683da965a1da3363efa67c14abf62b2d7d493",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC721BuyOrderFilled(
      address maker,
      address taker,
      address erc20Token,
      uint256 erc20TokenAmount,
      address erc721Token,
      uint256 erc721TokenId,
      bytes32 orderHash
    )`,
    ]),
};
exports.erc1155SellOrderFilled = {
    kind: "element-erc1155-sell-order-filled",
    addresses: { [(_c = sdk_1.Element.Addresses.Exchange[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0x3ae452568bed7ccafe4345f10048675bae78660c7ea37eb5112b572648d4f116",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC1155SellOrderFilled(
      address maker,
      address taker,
      address erc20Token,
      uint256 erc20FillAmount,
      address erc1155Token,
      uint256 erc1155TokenId,
      uint128 erc1155FillAmount,
      bytes32 orderHash
    )`,
    ]),
};
exports.erc1155BuyOrderFilled = {
    kind: "element-erc1155-buy-order-filled",
    addresses: { [(_d = sdk_1.Element.Addresses.Exchange[index_1.config.chainId]) === null || _d === void 0 ? void 0 : _d.toLowerCase()]: true },
    topic: "0x020486beb4ea38db8dc504078b03c4f758de372097584b434a8b8f53583eecac",
    numTopics: 1,
    abi: new abi_1.Interface([
        `event ERC1155BuyOrderFilled(
      address maker,
      address taker,
      address erc20Token,
      uint256 erc20FillAmount,
      address erc1155Token,
      uint256 erc1155TokenId,
      uint128 erc1155FillAmount,
      bytes32 orderHash
    )`,
    ]),
};
//# sourceMappingURL=element.js.map