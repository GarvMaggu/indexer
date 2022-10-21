export declare class SaleActivity {
    static handleEvent(data: FillEventData): Promise<void>;
}
export declare type FillEventData = {
    contract: string;
    tokenId: string;
    fromAddress: string;
    toAddress: string;
    price: number;
    amount: number;
    transactionHash: string;
    logIndex: number;
    batchIndex: number;
    blockHash: string;
    timestamp: number;
    orderId: string;
    orderSourceIdInt: number;
};
//# sourceMappingURL=sale-activity.d.ts.map