"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNftxFtPool = exports.saveNftxFtPool = exports.getNftxNftPool = exports.saveNftxNftPool = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const saveNftxNftPool = async (nftxNftPool) => {
    await db_1.idb.none(`
      INSERT INTO nftx_nft_pools (
        address,
        nft,
        vault_id
      ) VALUES (
        $/address/,
        $/nft/,
        $/vaultId/
      )
      ON CONFLICT DO NOTHING
    `, {
        address: (0, utils_1.toBuffer)(nftxNftPool.address),
        nft: (0, utils_1.toBuffer)(nftxNftPool.nft),
        vaultId: nftxNftPool.vaultId,
    });
    return nftxNftPool;
};
exports.saveNftxNftPool = saveNftxNftPool;
const getNftxNftPool = async (address) => {
    const result = await db_1.idb.oneOrNone(`
      SELECT
        nftx_nft_pools.address,
        nftx_nft_pools.nft,
        nftx_nft_pools.vault_id
      FROM nftx_nft_pools
      WHERE nftx_nft_pools.address = $/address/
    `, { address: (0, utils_1.toBuffer)(address) });
    return {
        address,
        nft: (0, utils_1.fromBuffer)(result.nft),
        vaultId: result.vault_id,
    };
};
exports.getNftxNftPool = getNftxNftPool;
const saveNftxFtPool = async (nftxFtPool) => {
    await db_1.idb.none(`
      INSERT INTO nftx_ft_pools (
        address,
        token0,
        token1
      ) VALUES (
        $/address/,
        $/token0/,
        $/token1/
      )
      ON CONFLICT DO NOTHING
    `, {
        address: (0, utils_1.toBuffer)(nftxFtPool.address),
        token0: (0, utils_1.toBuffer)(nftxFtPool.token0),
        token1: (0, utils_1.toBuffer)(nftxFtPool.token1),
    });
    return nftxFtPool;
};
exports.saveNftxFtPool = saveNftxFtPool;
const getNftxFtPool = async (address) => {
    const result = await db_1.idb.oneOrNone(`
      SELECT
        nftx_ft_pools.address,
        nftx_ft_pools.token0,
        nftx_ft_pools.token1
      FROM nftx_ft_pools
      WHERE nftx_ft_pools.address = $/address/
    `, { address: (0, utils_1.toBuffer)(address) });
    return {
        address,
        token0: (0, utils_1.fromBuffer)(result.token0),
        token1: (0, utils_1.fromBuffer)(result.token1),
    };
};
exports.getNftxFtPool = getNftxFtPool;
//# sourceMappingURL=index.js.map