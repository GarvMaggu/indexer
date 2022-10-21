"use strict";
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const axios_1 = __importDefault(require("axios"));
const simulation_1 = require("@/utils/simulation");
const BASE_URL = "https://api.reservoir.tools";
const main = async () => {
    const collections = [
        // Doodles
        ["0x8a90cab2b38dba80c64b7734e58ee1db38b8992e", "erc721"],
        // 10KTF Stockroom
        ["0x7daec605e9e2a1717326eedfd660601e2753a057", "erc1155"],
        // Foundation
        ["0x3b3ee1931dc30c1957379fac9aba94d1c48a5405", "erc721"],
        // Bored Ape Yacht Club
        ["0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", "erc721"],
    ];
    for (const [collection, kind] of collections) {
        // Get the floor token of the collection.
        const { tokens } = await axios_1.default
            .get(`${BASE_URL}/tokens/v4?collection=${collection}&limit=3`)
            .then(({ data }) => data);
        for (const { contract, tokenId } of tokens) {
            // Generate buy transaction.
            const { steps } = await axios_1.default
                .get(`${BASE_URL}/execute/buy/v2?token=${contract}:${tokenId}&taker=${simulation_1.genericTaker}&skipBalanceCheck=true`)
                .then(({ data }) => data);
            const tx = steps[0].data;
            const success = await (0, simulation_1.ensureBuyTxSucceeds)({
                kind: kind,
                contract,
                tokenId,
                amount: 1,
            }, tx);
            if (success) {
                console.log("SUCCESS");
            }
            else {
                console.log("FAILURE");
            }
        }
    }
};
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=simulate-buy.js.map