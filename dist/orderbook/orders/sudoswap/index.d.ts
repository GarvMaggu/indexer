import { OrderMetadata } from "@/orderbook/orders/utils";
export declare type OrderInfo = {
    orderParams: {
        pool: string;
        txTimestamp: number;
        txHash: string;
    };
    metadata: OrderMetadata;
};
declare type SaveResult = {
    id: string;
    txHash: string;
    status: string;
};
export declare const getOrderId: (pool: string, side: "sell" | "buy") => string;
export declare const save: (orderInfos: OrderInfo[]) => Promise<SaveResult[]>;
export {};
//# sourceMappingURL=index.d.ts.map