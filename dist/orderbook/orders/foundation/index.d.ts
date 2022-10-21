import { OrderMetadata } from "@/orderbook/orders/utils";
export declare type OrderInfo = {
    orderParams: {
        maker: string;
        contract: string;
        tokenId: string;
        price: string;
        txHash: string;
        txTimestamp: number;
    };
    metadata: OrderMetadata;
};
declare type SaveResult = {
    id: string;
    txHash?: string;
    status: string;
};
export declare const getOrderId: (contract: string, tokenId: string) => string;
export declare const save: (orderInfos: OrderInfo[]) => Promise<SaveResult[]>;
export {};
//# sourceMappingURL=index.d.ts.map