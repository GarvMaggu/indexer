import * as Sdk from "@reservoir0x/sdk";
import * as utils from "@/orderbook/orders/looks-rare/build/utils";
interface BuildOrderOptions extends utils.BaseOrderBuildOptions {
    tokenId: string;
}
export declare const build: (options: BuildOrderOptions) => Promise<Sdk.LooksRare.Order | undefined>;
export {};
//# sourceMappingURL=token.d.ts.map