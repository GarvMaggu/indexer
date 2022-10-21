import { BaseBuildParams } from "@reservoir0x/sdk/dist/looks-rare/builders/base";
export interface BaseOrderBuildOptions {
    maker: string;
    contract: string;
    weiPrice: string;
    listingTime?: number;
    expirationTime?: number;
}
declare type OrderBuildInfo = {
    params: BaseBuildParams;
};
export declare const getBuildInfo: (options: BaseOrderBuildOptions, collection: string, side: "sell" | "buy") => Promise<OrderBuildInfo>;
export {};
//# sourceMappingURL=utils.d.ts.map