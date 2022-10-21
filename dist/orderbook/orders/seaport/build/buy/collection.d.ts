import * as Sdk from "@reservoir0x/sdk";
import * as utils from "@/orderbook/orders/seaport/build/utils";
interface BuildOrderOptions extends utils.BaseOrderBuildOptions {
    collection: string;
}
export declare const build: (options: BuildOrderOptions) => Promise<Sdk.Seaport.Order>;
export {};
//# sourceMappingURL=collection.d.ts.map