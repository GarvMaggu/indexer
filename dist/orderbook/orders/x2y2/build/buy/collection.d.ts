import * as Sdk from "@reservoir0x/sdk";
import * as utils from "@/orderbook/orders/x2y2/build/utils";
interface BuildOrderOptions extends utils.BaseOrderBuildOptions {
    collection: string;
}
export declare const build: (options: BuildOrderOptions) => Promise<Sdk.X2Y2.Types.LocalOrder>;
export {};
//# sourceMappingURL=collection.d.ts.map