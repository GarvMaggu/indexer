"use strict";
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.askCancelled = exports.askPriceUpdated = exports.askCreated = exports.auctionEnded = exports.askFilled = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.askFilled = {
    kind: "zora-ask-filled",
    addresses: { [(_a = sdk_1.Zora.Addresses.Exchange[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0x21a9d8e221211780696258a05c6225b1a24f428e2fd4d51708f1ab2be4224d39",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event AskFilled(
      address indexed tokenContract,
      uint256 indexed tokenId,
      address indexed buyer,
      address finder,
      (
        address seller,
        address sellerFundsRecipient,
        address askCurrency,
        uint16 findersFeeBps,
        uint256 askPrice
      ) ask
    )`,
    ]),
};
exports.auctionEnded = {
    kind: "zora-auction-ended",
    addresses: { [(_b = sdk_1.Zora.Addresses.AuctionHouse[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0x4f35fb3ea0081b3ccbe8df613cab0f9e1694d50a025e0aa09b88a86a3d07c2de",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event AuctionEnded(
      uint256 indexed auctionId,
      uint256 indexed tokenId,
      address indexed tokenContract,
      address tokenOwner,
      address curator,
      address winner,
      uint256 amount,
      uint256 curatorFee,
      address auctionCurrency
    )`,
    ]),
};
exports.askCreated = {
    kind: "zora-ask-created",
    addresses: { [(_c = sdk_1.Zora.Addresses.Exchange[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0x5b65b398e1d736436510f4da442eaec71466d2abee0816567088c892c4bcee70",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event AskCreated(
        address indexed tokenContract,
        uint256 indexed tokenId,
        (
          address seller,
          address sellerFundsRecipient,
          address askCurrency,
          uint16 findersFeeBps,
          uint256 askPrice
        ) ask
      )`,
    ]),
};
exports.askPriceUpdated = {
    kind: "zora-ask-price-updated",
    addresses: { [(_d = sdk_1.Zora.Addresses.Exchange[index_1.config.chainId]) === null || _d === void 0 ? void 0 : _d.toLowerCase()]: true },
    topic: "0x1a24bcf5290feab70f35cfb4870c294ebf497e608d4262b0ec0debe045008140",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event AskPriceUpdated(
        address indexed tokenContract,
        uint256 indexed tokenId,
        (
          address seller,
          address sellerFundsRecipient,
          address askCurrency,
          uint16 findersFeeBps,
          uint256 askPrice
        ) ask
      )`,
    ]),
};
exports.askCancelled = {
    kind: "zora-ask-cancelled",
    addresses: { [(_e = sdk_1.Zora.Addresses.Exchange[index_1.config.chainId]) === null || _e === void 0 ? void 0 : _e.toLowerCase()]: true },
    topic: "0x871956abf85befb7c955eacd40fcabe7e01b1702d75764bf7f54bf481933fd35",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event AskCanceled(
        address indexed tokenContract,
        uint256 indexed tokenId,
        (
          address seller,
          address sellerFundsRecipient,
          address askCurrency,
          uint16 findersFeeBps,
          uint256 askPrice
        ) ask
      )`,
    ]),
};
//# sourceMappingURL=zora.js.map