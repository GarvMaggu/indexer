"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSudoswapPool = exports.saveSudoswapPool = exports.SudoswapPoolKind = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
var SudoswapPoolKind;
(function (SudoswapPoolKind) {
    SudoswapPoolKind[SudoswapPoolKind["TOKEN"] = 0] = "TOKEN";
    SudoswapPoolKind[SudoswapPoolKind["NFT"] = 1] = "NFT";
    SudoswapPoolKind[SudoswapPoolKind["TRADE"] = 2] = "TRADE";
})(SudoswapPoolKind = exports.SudoswapPoolKind || (exports.SudoswapPoolKind = {}));
const saveSudoswapPool = async (sudoswapPool) => {
    await db_1.idb.none(`
      INSERT INTO sudoswap_pools (
        address,
        nft,
        token,
        bonding_curve,
        pool_kind,
        pair_kind
      ) VALUES (
        $/address/,
        $/nft/,
        $/token/,
        $/bondingCurve/,
        $/poolKind/,
        $/pairKind/
      )
      ON CONFLICT DO NOTHING
    `, {
        address: (0, utils_1.toBuffer)(sudoswapPool.address),
        nft: (0, utils_1.toBuffer)(sudoswapPool.nft),
        token: (0, utils_1.toBuffer)(sudoswapPool.token),
        bondingCurve: (0, utils_1.toBuffer)(sudoswapPool.bondingCurve),
        poolKind: sudoswapPool.poolKind,
        pairKind: sudoswapPool.pairKind,
    });
    return sudoswapPool;
};
exports.saveSudoswapPool = saveSudoswapPool;
const getSudoswapPool = async (address) => {
    const result = await db_1.idb.oneOrNone(`
      SELECT
        sudoswap_pools.address,
        sudoswap_pools.nft,
        sudoswap_pools.token,
        sudoswap_pools.bonding_curve,
        sudoswap_pools.pool_kind,
        sudoswap_pools.pair_kind
      FROM sudoswap_pools
      WHERE sudoswap_pools.address = $/address/
    `, { address: (0, utils_1.toBuffer)(address) });
    return {
        address,
        nft: (0, utils_1.fromBuffer)(result.nft),
        token: (0, utils_1.fromBuffer)(result.token),
        bondingCurve: (0, utils_1.fromBuffer)(result.bonding_curve),
        poolKind: result.pool_kind,
        pairKind: result.pair_kind,
    };
};
exports.getSudoswapPool = getSudoswapPool;
//# sourceMappingURL=index.js.map