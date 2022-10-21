import * as Sdk from "@reservoir0x/sdk";
import { OrderSide } from "@reservoir0x/sdk/dist/universe/types";
export interface BaseOrderBuildOptions {
    maker: string;
    contract: string;
    tokenId: string;
    quantity: number;
    salt: number;
    currency: string;
    nftAssetClass: string;
    weiPrice: string;
    listingTime: number;
    expirationTime: number;
    signature: string;
    fees: string[];
}
declare type OrderBuildInfo = {
    params: Sdk.Universe.Types.BaseBuildParams;
};
export declare const getBuildInfo: (options: BaseOrderBuildOptions, collection: string, side: Sdk.Universe.Types.OrderSide) => Promise<OrderBuildInfo>;
export {};
//# sourceMappingURL=utils.d.ts.map