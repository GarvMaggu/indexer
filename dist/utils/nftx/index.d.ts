import { Log } from "@ethersproject/abstract-provider";
export declare const getNftPoolDetails: (address: string) => Promise<import("@/models/nftx-pools").NftxNftPool | undefined>;
export declare const getFtPoolDetails: (address: string) => Promise<import("@/models/nftx-pools").NftxFtPool | undefined>;
export declare const isMint: (log: Log, address: string) => true | undefined;
export declare const isRedeem: (log: Log, address: string) => true | undefined;
export declare const isSwap: (log: Log) => boolean;
export declare const tryParseSwap: (log: Log) => Promise<{
    ftPool: import("@/models/nftx-pools").NftxFtPool;
    amount0In: any;
    amount1In: any;
    amount0Out: any;
    amount1Out: any;
} | undefined>;
//# sourceMappingURL=index.d.ts.map