import * as Sdk from "@reservoir0x/sdk";
import * as utils from "@/orderbook/orders/zeroex-v4/build/utils";
interface BuildOrderOptions extends utils.BaseOrderBuildOptions {
    tokenId: string;
}
export declare const build: (options: BuildOrderOptions) => Promise<Sdk.ZeroExV4.Order | undefined>;
export {};
//# sourceMappingURL=token.d.ts.map