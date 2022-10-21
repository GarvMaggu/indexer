"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawal = exports.deposit = exports.approval = exports.transfer = void 0;
const abi_1 = require("@ethersproject/abi");
const sdk_1 = require("@reservoir0x/sdk");
const index_1 = require("@/config/index");
exports.transfer = {
    kind: "erc20-transfer",
    addresses: { [(_a = sdk_1.Common.Addresses.Weth[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()]: true },
    topic: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event Transfer(
      address indexed from,
      address indexed to,
      uint256 amount
    )`,
    ]),
};
exports.approval = {
    kind: "erc20-approval",
    addresses: { [(_b = sdk_1.Common.Addresses.Weth[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b.toLowerCase()]: true },
    topic: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event Approval(
      address indexed owner,
      address indexed spender,
      uint256 value
    )`,
    ]),
};
exports.deposit = {
    kind: "weth-deposit",
    addresses: { [(_c = sdk_1.Common.Addresses.Weth[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c.toLowerCase()]: true },
    topic: "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event Deposit(
      address indexed to,
      uint256 amount
    )`,
    ]),
};
exports.withdrawal = {
    kind: "weth-withdrawal",
    addresses: { [(_d = sdk_1.Common.Addresses.Weth[index_1.config.chainId]) === null || _d === void 0 ? void 0 : _d.toLowerCase()]: true },
    topic: "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65",
    numTopics: 2,
    abi: new abi_1.Interface([
        `event Withdrawal(
      address indexed from,
      uint256 amount
    )`,
    ]),
};
//# sourceMappingURL=weth.js.map