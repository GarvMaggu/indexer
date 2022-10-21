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
exports.syncArweave = void 0;
const axios_1 = __importDefault(require("axios"));
const graphql_request_1 = require("graphql-request");
const v001 = __importStar(require("@/arweave-sync/common/v001"));
const provider_1 = require("@/common/provider");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const network_1 = require("@/config/network");
const syncArweave = async (options) => {
    var _a, _b, _c;
    const transactions = [];
    const batchSize = 100;
    // https://gist.github.com/TheLoneRonin/08d9fe4a43486815c78d6bebb2da4fff
    const { fromBlock, toBlock, afterCursor, pending } = options;
    const query = (0, graphql_request_1.gql) `
    {
      transactions(
        tags: [
          { name: "App-Name", values: ["Reservoir Protocol"] },
          { name: "Network", values: ["${(0, network_1.getNetworkName)()}"] }
        ]
        first: ${batchSize}
        sort: ${pending ? "HEIGHT_DESC" : "HEIGHT_ASC"}
        ${fromBlock && toBlock
        ? `block: { min: ${fromBlock}, max: ${toBlock} }`
        : fromBlock
            ? `block: { min: ${fromBlock} }`
            : toBlock
                ? `block: { max: ${toBlock} }`
                : ""}
        ${afterCursor ? `after: "${afterCursor}"` : ""}
      ) {
        edges {
          cursor
          node {
            id
            tags {
              name
              value
            }
            block {
              height
            }
          }
        }
      }
    }
  `;
    const { protocol, host } = provider_1.arweaveGateway.api.config;
    const data = await (0, graphql_request_1.request)(`${protocol}://${host}/graphql`, query);
    const results = (_b = (_a = data === null || data === void 0 ? void 0 : data.transactions) === null || _a === void 0 ? void 0 : _a.edges) !== null && _b !== void 0 ? _b : [];
    let lastBlock;
    if (results.length) {
        lastBlock = results[results.length - 1].node.block.height;
    }
    let lastCursor;
    if (results.length) {
        lastCursor = results[results.length - 1].cursor;
    }
    for (const { node } of results) {
        // https://discordapp.com/channels/357957786904166400/358038065974870018/940653379133272134
        if (pending && node.block) {
            break;
        }
        const transactionCache = await redis_1.redis.get(`arweave-transaction-${node.id}`);
        if (transactionCache) {
            // Skip if we already processed this particular transaction
            continue;
        }
        else {
            if (pending) {
                logger_1.logger.info("sync-arweave", `Got pending transaction ${node.id}`);
            }
            // Optimistically cache the pending transaction as processed
            await redis_1.redis.set(`arweave-transaction-${node.id}`, "1", "EX", 3600);
        }
        try {
            const version = (_c = node.tags.find((t) => t.name === "App-Version")) === null || _c === void 0 ? void 0 : _c.value;
            if (!version) {
                // Skip unversioned transactions
                continue;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let data;
            if (pending) {
                // https://discordapp.com/channels/357957786904166400/358038065974870018/945399371426582579
                const result = await axios_1.default.get(`${protocol}://${host}/${node.id}`, {
                    timeout: 60000,
                });
                data = result.data;
            }
            else {
                data = JSON.parse((await provider_1.arweaveGateway.transactions.getData(node.id, {
                    decode: true,
                    string: true,
                })));
            }
            switch (version) {
                case "0.0.1": {
                    await v001.processTransactionData(data);
                    break;
                }
                default: {
                    logger_1.logger.info("sync-arweave", `Unrecognized version ${version}`);
                    break;
                }
            }
        }
        catch (error) {
            // Ignore any errors
            logger_1.logger.error("sync-arweave", `Failed to handle transaction ${node.id}: ${error}`);
        }
    }
    return {
        lastBlock,
        lastCursor,
        done: results.length < batchSize,
        transactions,
    };
};
exports.syncArweave = syncArweave;
//# sourceMappingURL=index.js.map