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
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryParseSwap = exports.isSwap = exports.isRedeem = exports.isMint = exports.getFtPoolDetails = exports.getNftPoolDetails = void 0;
const abi_1 = require("@ethersproject/abi");
const contracts_1 = require("@ethersproject/contracts");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const provider_1 = require("@/common/provider");
const index_1 = require("@/config/index");
const nftx = __importStar(require("@/events-sync/data/nftx"));
const nftx_pools_1 = require("@/models/nftx-pools");
const getNftPoolDetails = async (address) => (0, nftx_pools_1.getNftxNftPool)(address).catch(async () => {
    if (Sdk.Nftx.Addresses.VaultFactory[index_1.config.chainId]) {
        const iface = new abi_1.Interface([
            "function assetAddress() view returns (address)",
            "function vaultId() view returns (uint256)",
            "function vault(uint256) view returns (address)",
        ]);
        try {
            const pool = new contracts_1.Contract(address, iface, provider_1.baseProvider);
            const nft = await pool.assetAddress();
            const vaultId = await pool.vaultId();
            const factory = new contracts_1.Contract(Sdk.Nftx.Addresses.VaultFactory[index_1.config.chainId], iface, provider_1.baseProvider);
            if ((await factory.vault(vaultId)).toLowerCase() === address) {
                return (0, nftx_pools_1.saveNftxNftPool)({
                    address,
                    nft,
                    vaultId: vaultId.toString(),
                });
            }
        }
        catch {
            // Skip any errors
        }
    }
});
exports.getNftPoolDetails = getNftPoolDetails;
const getFtPoolDetails = async (address) => (0, nftx_pools_1.getNftxFtPool)(address).catch(async () => {
    if (Sdk.Nftx.Addresses.VaultFactory[index_1.config.chainId]) {
        const iface = new abi_1.Interface([
            "function token0() view returns (address)",
            "function token1() view returns (address)",
        ]);
        try {
            const pool = new contracts_1.Contract(address, iface, provider_1.baseProvider);
            const token0 = await pool.token0();
            const token1 = await pool.token1();
            return (0, nftx_pools_1.saveNftxFtPool)({
                address,
                token0,
                token1,
            });
        }
        catch {
            // Skip any errors
        }
    }
});
exports.getFtPoolDetails = getFtPoolDetails;
const isMint = (log, address) => {
    if (log.topics[0] === nftx.minted.abi.getEventTopic("Minted") &&
        log.address.toLowerCase() === address) {
        return true;
    }
};
exports.isMint = isMint;
const isRedeem = (log, address) => {
    if (log.topics[0] === nftx.redeemed.abi.getEventTopic("Redeemed") &&
        log.address.toLowerCase() === address) {
        return true;
    }
};
exports.isRedeem = isRedeem;
const ifaceUniV2 = new abi_1.Interface([
    `event Swap(
    address indexed sender,
    uint256 amount0In,
    uint256 amount1In,
    uint256 amount0Out,
    uint256 amount1Out,
    address indexed to
  )`,
]);
const ifaceUniV3 = new abi_1.Interface([
    `event Swap(
    address indexed sender,
    address indexed recipient,
    int256 amount0,
    int256 amount1,
    uint160 sqrtPriceX96,
    uint128 liquidity,
    int24 tick
  )`,
]);
const isSwap = (log) => {
    if ([ifaceUniV2.getEventTopic("Swap"), ifaceUniV3.getEventTopic("Swap")].includes(log.topics[0])) {
        return true;
    }
    return false;
};
exports.isSwap = isSwap;
const tryParseSwap = async (log) => {
    // We only support parsing UniswapV2-like swaps for now
    // TODO: Add support for UniswapV3-like swaps and multi-swaps
    // (eg. https://etherscan.io/tx/0x04cc2def87437c608f743ab0bfe90d4a80997cd7e6c0503e6472bb3dd084a167)
    if (log.topics[0] === ifaceUniV2.getEventTopic("Swap")) {
        const ftPool = await (0, exports.getFtPoolDetails)(log.address.toLowerCase());
        if (ftPool) {
            const parsedLog = ifaceUniV2.parseLog(log);
            return {
                ftPool,
                amount0In: parsedLog.args["amount0In"].toString(),
                amount1In: parsedLog.args["amount1In"].toString(),
                amount0Out: parsedLog.args["amount0Out"].toString(),
                amount1Out: parsedLog.args["amount1Out"].toString(),
            };
        }
    }
};
exports.tryParseSwap = tryParseSwap;
//# sourceMappingURL=index.js.map