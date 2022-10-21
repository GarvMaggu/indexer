export declare class BidCancelActivity {
    static handleEvent(data: BuyOrderCancelledEventData): Promise<void>;
}
export declare type BuyOrderCancelledEventData = {
    orderId: string;
    contract: string;
    maker: string;
    price: number;
    amount: number;
    transactionHash: string;
    logIndex: number;
    batchIndex: number;
    blockHash: string;
    timestamp: number;
    orderSourceIdInt: number;
};
//# sourceMappingURL=bid-cancel-activity.d.ts.map