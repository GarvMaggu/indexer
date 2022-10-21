import { OrderMetadata } from "@/orderbook/orders/utils";
export declare type OrderIdParams = {
    tokenContract: string;
    tokenId: string;
};
export declare type OrderInfo = {
    orderParams: {
        seller: string;
        maker: string;
        tokenContract: string;
        tokenId: string;
        askPrice: string;
        askCurrency: string;
        sellerFundsRecipient: string;
        findersFeeBps: number;
        side: "sell" | "buy";
        txHash: string;
        txTimestamp: number;
    };
    metadata: OrderMetadata;
};
export declare function getOrderId(orderParams: OrderIdParams): string;
declare type SaveResult = {
    id: string;
    status: string;
    txHash: string;
    unfillable?: boolean;
};
export declare const save: (orderInfos: OrderInfo[]) => Promise<SaveResult[]>;
export {};
//# sourceMappingURL=index.d.ts.map