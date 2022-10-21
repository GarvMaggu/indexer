import { BaseBuildParams } from "@reservoir0x/sdk/dist/x2y2/builders/base";
export interface BaseOrderBuildOptions {
    maker: string;
    contract: string;
    weiPrice: string;
    orderbook: "x2y2";
    expirationTime?: number;
    salt?: string;
}
declare type OrderBuildInfo = {
    params: BaseBuildParams;
};
export declare const getBuildInfo: (options: BaseOrderBuildOptions, collection: string, side: "sell" | "buy") => Promise<OrderBuildInfo>;
export {};
//# sourceMappingURL=utils.d.ts.map