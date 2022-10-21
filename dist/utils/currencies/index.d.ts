declare type CurrencyMetadata = {
    coingeckoCurrencyId?: string;
    image?: string;
};
export declare type Currency = {
    contract: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    metadata?: CurrencyMetadata;
};
export declare const getCurrency: (currencyAddress: string) => Promise<Currency>;
export declare const tryGetCurrencyDetails: (currencyAddress: string) => Promise<{
    name: any;
    symbol: any;
    decimals: any;
    metadata: CurrencyMetadata;
}>;
export {};
//# sourceMappingURL=index.d.ts.map