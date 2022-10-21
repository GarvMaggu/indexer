export declare enum SudoswapPoolKind {
    TOKEN = 0,
    NFT = 1,
    TRADE = 2
}
export declare type SudoswapPool = {
    address: string;
    nft: string;
    token: string;
    bondingCurve: string;
    poolKind: SudoswapPoolKind;
    pairKind: number;
};
export declare const saveSudoswapPool: (sudoswapPool: SudoswapPool) => Promise<SudoswapPool>;
export declare const getSudoswapPool: (address: string) => Promise<SudoswapPool>;
//# sourceMappingURL=index.d.ts.map