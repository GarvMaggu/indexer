import * as Sdk from "@reservoir0x/sdk";
import { OrderMetadata } from "@/orderbook/orders/utils";
export declare type OrderInfo = {
    orderParams: Sdk.LooksRare.Types.MakerOrderParams;
    metadata: OrderMetadata;
};
declare type SaveResult = {
    id: string;
    status: string;
    unfillable?: boolean;
};
export declare const save: (orderInfos: OrderInfo[], relayToArweave?: boolean | undefined) => Promise<SaveResult[]>;
export {};
//# sourceMappingURL=index.d.ts.map