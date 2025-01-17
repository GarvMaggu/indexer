"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalForAll = exports.transfer = void 0;
const abi_1 = require("@ethersproject/abi");
// There are some NFTs which do not strictly adhere to the ERC721
// standard (eg. Cryptovoxels) but it would still be good to have
// support for them. We should have custom rules for these.
exports.transfer = {
    kind: "erc721-transfer",
    topic: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    numTopics: 4,
    abi: new abi_1.Interface([
        `event Transfer(
      address indexed from,
      address indexed to,
      uint256 indexed tokenId
    )`,
    ]),
};
// The `ApprovalForAll` event is the same for erc721 and erc1155
exports.approvalForAll = {
    kind: "erc721/1155-approval-for-all",
    topic: "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31",
    numTopics: 3,
    abi: new abi_1.Interface([
        `event ApprovalForAll(
      address indexed owner,
      address indexed operator,
      bool approved
    )`,
    ]),
};
//# sourceMappingURL=erc721.js.map