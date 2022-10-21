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
exports.extractAttributionData = exports.fetchTransactionLogs = exports.fetchTransactionTrace = exports.fetchTransaction = exports.fetchBlock = void 0;
const abi_1 = require("@ethersproject/abi");
const constants_1 = require("@ethersproject/constants");
const evm_tx_simulator_1 = require("@georgeroman/evm-tx-simulator");
const SdkNew = __importStar(require("@reservoir0x/sdk-new"));
const utils_1 = require("@reservoir0x/sdk/dist/utils");
const p_limit_1 = __importDefault(require("p-limit"));
const provider_1 = require("@/common/provider");
const utils_2 = require("@/common/utils");
const index_1 = require("@/config/index");
const blocks_1 = require("@/models/blocks");
const sources_1 = require("@/models/sources");
const transactions_1 = require("@/models/transactions");
const transaction_logs_1 = require("@/models/transaction-logs");
const transaction_traces_1 = require("@/models/transaction-traces");
const orders_1 = require("@/orderbook/orders");
const fetchBlock = async (blockNumber, force = false) => (0, blocks_1.getBlocks)(blockNumber)
    // Only fetch a single block (multiple ones might be available due to reorgs)
    .then(async (blocks) => {
    if (blocks.length && !force) {
        return blocks[0];
    }
    else {
        const block = await provider_1.baseProvider.getBlockWithTransactions(blockNumber);
        // Save all transactions within the block
        const limit = (0, p_limit_1.default)(20);
        await Promise.all(block.transactions.map((tx) => limit(async () => {
            var _a;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawTx = tx.raw;
            const gasPrice = (_a = tx.gasPrice) === null || _a === void 0 ? void 0 : _a.toString();
            const gasUsed = (rawTx === null || rawTx === void 0 ? void 0 : rawTx.gas) ? (0, utils_2.bn)(rawTx.gas).toString() : undefined;
            const gasFee = gasPrice && gasUsed ? (0, utils_2.bn)(gasPrice).mul(gasUsed).toString() : undefined;
            await (0, transactions_1.saveTransaction)({
                hash: tx.hash.toLowerCase(),
                from: tx.from.toLowerCase(),
                to: (tx.to || constants_1.AddressZero).toLowerCase(),
                value: tx.value.toString(),
                data: tx.data.toLowerCase(),
                blockNumber: block.number,
                blockTimestamp: block.timestamp,
                gasPrice,
                gasUsed,
                gasFee,
            });
        })));
        return (0, blocks_1.saveBlock)({
            number: block.number,
            hash: block.hash,
            timestamp: block.timestamp,
        });
    }
});
exports.fetchBlock = fetchBlock;
const fetchTransaction = async (txHash) => (0, transactions_1.getTransaction)(txHash).catch(async () => {
    // TODO: This should happen very rarely since all transactions
    // should be readily available. The only case when data misses
    // is when a block reorg happens and the replacing block takes
    // in transactions that were missing in the previous block. In
    // this case we don't refetch the new block's transactions but
    // assume it cannot include new transactions. But that's not a
    // a good assumption so we should force re-fetch the new block
    // together with its transactions when a reorg happens.
    let tx = await provider_1.baseProvider.getTransaction(txHash);
    if (!tx) {
        tx = await provider_1.baseProvider.getTransaction(txHash);
    }
    // Also fetch all transactions within the block
    const blockTimestamp = (await (0, exports.fetchBlock)(tx.blockNumber, true)).timestamp;
    // TODO: Fetch gas fields via `eth_getTransactionReceipt`
    // Sometimes `effectiveGasPrice` can be null
    // const txReceipt = await baseProvider.getTransactionReceipt(txHash);
    // const gasPrice = txReceipt.effectiveGasPrice || tx.gasPrice || 0;
    return (0, transactions_1.saveTransaction)({
        hash: tx.hash.toLowerCase(),
        from: tx.from.toLowerCase(),
        to: (tx.to || constants_1.AddressZero).toLowerCase(),
        value: tx.value.toString(),
        data: tx.data.toLowerCase(),
        blockNumber: tx.blockNumber,
        blockTimestamp,
        // gasUsed: txReceipt.gasUsed.toString(),
        // gasPrice: gasPrice.toString(),
        // gasFee: txReceipt.gasUsed.mul(gasPrice).toString(),
    });
});
exports.fetchTransaction = fetchTransaction;
const fetchTransactionTrace = async (txHash) => (0, transaction_traces_1.getTransactionTrace)(txHash)
    .catch(async () => {
    const transactionTrace = await (0, evm_tx_simulator_1.getTxTrace)({ hash: txHash }, provider_1.baseProvider);
    return (0, transaction_traces_1.saveTransactionTrace)({
        hash: txHash,
        calls: transactionTrace,
    });
})
    .catch(() => undefined);
exports.fetchTransactionTrace = fetchTransactionTrace;
const fetchTransactionLogs = async (txHash) => (0, transaction_logs_1.getTransactionLogs)(txHash).catch(async () => {
    const receipt = await provider_1.baseProvider.getTransactionReceipt(txHash);
    return (0, transaction_logs_1.saveTransactionLogs)({
        hash: txHash,
        logs: receipt.logs,
    });
});
exports.fetchTransactionLogs = fetchTransactionLogs;
const extractAttributionData = async (txHash, orderKind, address) => {
    var _a, _b, _c, _d;
    const sources = await sources_1.Sources.getInstance();
    let aggregatorSource;
    let fillSource;
    let taker;
    const orderSource = await (0, orders_1.getOrderSourceByOrderKind)(orderKind, address);
    // Properly set the taker when filling through router contracts
    const tx = await (0, exports.fetchTransaction)(txHash);
    let router = (_a = SdkNew.Common.Addresses.Routers[index_1.config.chainId]) === null || _a === void 0 ? void 0 : _a[tx.to];
    if (!router) {
        // Handle cases where we transfer directly to the router when filling bids
        if (tx.data.startsWith("0xb88d4fde")) {
            const iface = new abi_1.Interface([
                "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
            ]);
            const result = iface.decodeFunctionData("safeTransferFrom", tx.data);
            router = (_b = SdkNew.Common.Addresses.Routers[index_1.config.chainId]) === null || _b === void 0 ? void 0 : _b[result.to.toLowerCase()];
        }
        else if (tx.data.startsWith("0xf242432a")) {
            const iface = new abi_1.Interface([
                "function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)",
            ]);
            const result = iface.decodeFunctionData("safeTransferFrom", tx.data);
            router = (_c = SdkNew.Common.Addresses.Routers[index_1.config.chainId]) === null || _c === void 0 ? void 0 : _c[result.to.toLowerCase()];
        }
    }
    if (router) {
        taker = tx.from;
    }
    let referrer = (0, utils_1.getReferrer)(tx.data);
    if (!referrer) {
        const last4Bytes = "0x" + tx.data.slice(-8);
        referrer = (_d = sources.getByDomainHash(last4Bytes)) === null || _d === void 0 ? void 0 : _d.domain;
    }
    // Reference: https://github.com/reservoirprotocol/core/issues/22#issuecomment-1191040945
    if (referrer) {
        // TODO: Properly handle aggregator detection
        if (referrer !== "opensea.io" && referrer !== "gem.xyz") {
            // Do not associate OpenSea / Gem direct fills to Reservoir
            aggregatorSource = await sources.getOrInsert("reservoir.tools");
        }
        else if (referrer === "gem.xyz") {
            // Associate Gem direct fills to Gem
            aggregatorSource = await sources.getOrInsert("gem.xyz");
        }
        fillSource = await sources.getOrInsert(referrer);
    }
    else if (router === "reservoir.tools") {
        aggregatorSource = await sources.getOrInsert("reservoir.tools");
    }
    else if (router) {
        aggregatorSource = await sources.getOrInsert(router);
        fillSource = await sources.getOrInsert(router);
    }
    else {
        fillSource = orderSource;
    }
    return {
        orderSource,
        fillSource,
        aggregatorSource,
        taker,
    };
};
exports.extractAttributionData = extractAttributionData;
//# sourceMappingURL=utils.js.map