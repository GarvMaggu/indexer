"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const abi_1 = require("@ethersproject/abi");
const contracts_1 = require("@ethersproject/contracts");
const providers_1 = require("@ethersproject/providers");
const wallet_1 = require("@ethersproject/wallet");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const axios_1 = __importDefault(require("axios"));
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
// MASTER ONLY
if (index_1.config.doBackgroundWork && index_1.config.master && index_1.config.chainId === 5) {
    // Publish new prices to data feeds every hour
    node_cron_1.default.schedule("0 0 */1 * * *", async () => await redis_1.redlock
        .acquire(["oracle-price-publish"], (3600 - 60) * 1000)
        .then(async () => {
        try {
            // Ideally every indexer should only publish prices to the chain it's
            // running on. However, for testing purposes we make an exception and
            // relay prices to a different network.
            // Test data feeds: "BAYC / USDC", "CHIMP / USDC"
            const dataFeeds = [
                {
                    collection: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d",
                    feed: "0xC5B29989e47bb0a17B0870b027BE26522d654BF5",
                },
                {
                    collection: "0x80336ad7a747236ef41f47ed2c7641828a480baa",
                    feed: "0x8fF91c16a42c45D20F4A0806afb5ab9C9112f472",
                },
            ];
            const provider = new providers_1.AlchemyProvider("kovan");
            for (const { collection, feed } of dataFeeds) {
                const iface = new abi_1.Interface([
                    {
                        inputs: [
                            {
                                components: [
                                    {
                                        internalType: "bytes32",
                                        name: "id",
                                        type: "bytes32",
                                    },
                                    {
                                        internalType: "bytes",
                                        name: "payload",
                                        type: "bytes",
                                    },
                                    {
                                        internalType: "uint256",
                                        name: "timestamp",
                                        type: "uint256",
                                    },
                                    {
                                        internalType: "bytes",
                                        name: "signature",
                                        type: "bytes",
                                    },
                                ],
                                name: "message",
                                type: "tuple",
                            },
                        ],
                        name: "recordPrice",
                        outputs: [],
                        stateMutability: "nonpayable",
                        type: "function",
                    },
                ]);
                const contract = new contracts_1.Contract(feed, iface, provider);
                if (index_1.config.oraclePrivateKey) {
                    // Fetch the oracle message
                    const message = await axios_1.default
                        .get(`https://api.reservoir.tools/oracle/collections/${collection}/floor-ask/v1?kind=twap&currency=${Sdk.Common.Addresses.Usdc[42]}`)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .then((response) => response.data.message);
                    logger_1.logger.info("oracle-price-publish", JSON.stringify(message));
                    // Wait for 1 minute to make sure on-chain validation passes
                    await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
                    // Publish the price
                    const tx = await contract
                        .connect(new wallet_1.Wallet(index_1.config.oraclePrivateKey).connect(provider))
                        .recordPrice(message);
                    const txReceipt = await tx.wait();
                    logger_1.logger.info("oracle-price-publish", `Relayed price publish transaction: ${txReceipt.transactionHash}`);
                }
                else {
                    logger_1.logger.info("oracle-price-publish", "Skipped publishing prices");
                }
            }
        }
        catch (error) {
            logger_1.logger.error("oracle-price-publish", `Failed to publish new prices: ${error}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
}
//# sourceMappingURL=index.js.map