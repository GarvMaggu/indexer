export declare type Price = {
    currency: string;
    timestamp: number;
    value: string;
};
declare type USDAndNativePrices = {
    usdPrice?: string;
    nativePrice?: string;
};
export declare const getUSDAndNativePrices: (currencyAddress: string, price: string, timestamp: number, options?: {
    onlyUSD?: boolean | undefined;
} | undefined) => Promise<USDAndNativePrices>;
export {};
//# sourceMappingURL=index.d.ts.map