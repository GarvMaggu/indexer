import * as Sdk from "@reservoir0x/sdk";
import { OrderMetadata } from "@/orderbook/orders/utils";
export declare type OrderInfo = {
    orderParams: Sdk.Seaport.Types.OrderComponents;
    metadata: OrderMetadata;
    isReservoir?: boolean;
};
declare type SaveResult = {
    id: string;
    status: string;
    unfillable?: boolean;
};
export declare const save: (orderInfos: OrderInfo[], relayToArweave?: boolean | undefined, validateBidValue?: boolean | undefined) => Promise<SaveResult[]>;
export declare const handleTokenList: (orderId: string, contract: string, tokenSetId: string, merkleRoot: string) => Promise<void>;
export declare const getCollectionFloorAskValue: (contract: string, tokenId: number) => Promise<number | undefined>;
export {};
//# sourceMappingURL=index.d.ts.map