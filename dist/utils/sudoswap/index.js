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
exports.getPoolDetails = void 0;
const abi_1 = require("@ethersproject/abi");
const constants_1 = require("@ethersproject/constants");
const contracts_1 = require("@ethersproject/contracts");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const provider_1 = require("@/common/provider");
const index_1 = require("@/config/index");
const sudoswap_pools_1 = require("@/models/sudoswap-pools");
const getPoolDetails = async (address) => (0, sudoswap_pools_1.getSudoswapPool)(address).catch(async () => {
    if (Sdk.Sudoswap.Addresses.PairFactory[index_1.config.chainId]) {
        const iface = new abi_1.Interface([
            "function nft() view returns (address)",
            "function token() view returns (address)",
            "function bondingCurve() view returns (address)",
            "function poolType() view returns (uint8)",
            "function pairVariant() view returns (uint8)",
            "function isPair(address pair, uint8 variant) view returns (bool)",
        ]);
        try {
            const pool = new contracts_1.Contract(address, iface, provider_1.baseProvider);
            const nft = await pool.nft();
            const bondingCurve = await pool.bondingCurve();
            const poolKind = await pool.poolType();
            const pairKind = await pool.pairVariant();
            const token = pairKind > 1 ? await pool.token() : constants_1.AddressZero;
            const factory = new contracts_1.Contract(Sdk.Sudoswap.Addresses.PairFactory[index_1.config.chainId], iface, provider_1.baseProvider);
            if (await factory.isPair(address, pairKind)) {
                return (0, sudoswap_pools_1.saveSudoswapPool)({
                    address,
                    nft,
                    token,
                    bondingCurve,
                    poolKind,
                    pairKind,
                });
            }
        }
        catch {
            // Skip any errors
        }
    }
});
exports.getPoolDetails = getPoolDetails;
//# sourceMappingURL=index.js.map