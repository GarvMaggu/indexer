export declare type NftxNftPool = {
    address: string;
    nft: string;
    vaultId: number;
};
export declare const saveNftxNftPool: (nftxNftPool: NftxNftPool) => Promise<NftxNftPool>;
export declare const getNftxNftPool: (address: string) => Promise<NftxNftPool>;
export declare type NftxFtPool = {
    address: string;
    token0: string;
    token1: string;
};
export declare const saveNftxFtPool: (nftxFtPool: NftxFtPool) => Promise<NftxFtPool>;
export declare const getNftxFtPool: (address: string) => Promise<NftxFtPool>;
//# sourceMappingURL=index.d.ts.map