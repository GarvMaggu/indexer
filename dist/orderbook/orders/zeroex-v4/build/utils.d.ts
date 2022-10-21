import { BaseBuildParams } from "@reservoir0x/sdk/dist/zeroex-v4/builders/base";
export interface BaseOrderBuildOptions {
    maker: string;
    contract: string;
    weiPrice: string;
    orderbook: "reservoir";
    quantity?: number;
    nonce?: string;
    fee?: number[];
    feeRecipient?: string[];
    expirationTime?: number;
    automatedRoyalties?: boolean;
    excludeFlaggedTokens?: boolean;
}
export declare type OrderBuildInfo = {
    params: BaseBuildParams;
    kind: "erc721" | "erc1155";
};
export declare const getBuildInfo: (options: BaseOrderBuildOptions, collection: string, side: "sell" | "buy") => Promise<OrderBuildInfo>;
//# sourceMappingURL=utils.d.ts.map