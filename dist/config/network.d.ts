export declare const getNetworkName: () => "mainnet" | "rinkeby" | "goerli" | "optimism" | "polygon" | "unknown";
export declare const getServiceName: () => string;
declare type NetworkSettings = {
    enableWebSocket: boolean;
    enableReorgCheck: boolean;
    reorgCheckFrequency: number[];
    realtimeSyncFrequencySeconds: number;
    realtimeSyncMaxBlockLag: number;
    backfillBlockBatchSize: number;
    metadataMintDelay: number;
    enableMetadataAutoRefresh: boolean;
    washTradingExcludedContracts: string[];
    washTradingWhitelistedAddresses: string[];
    washTradingBlacklistedAddresses: string[];
    mintsAsSalesBlacklist: string[];
    multiCollectionContracts: string[];
    coingecko?: {
        networkId: string;
    };
    onStartup?: () => Promise<void>;
};
export declare const getNetworkSettings: () => NetworkSettings;
export {};
//# sourceMappingURL=network.d.ts.map