import { BaseBuildParams } from "@reservoir0x/sdk/dist/seaport/builders/base";
export interface BaseOrderBuildOptions {
    maker: string;
    contract: string;
    weiPrice: string;
    orderbook: "opensea" | "reservoir";
    currency?: string;
    quantity?: number;
    nonce?: string;
    fee?: number[];
    feeRecipient?: string[];
    listingTime?: number;
    expirationTime?: number;
    salt?: string;
    automatedRoyalties?: boolean;
    excludeFlaggedTokens?: boolean;
}
declare type OrderBuildInfo = {
    params: BaseBuildParams;
    kind: "erc721" | "erc1155";
};
export declare const getBuildInfo: (options: BaseOrderBuildOptions, collection: string, side: "sell" | "buy") => Promise<OrderBuildInfo>;
export {};
//# sourceMappingURL=utils.d.ts.map