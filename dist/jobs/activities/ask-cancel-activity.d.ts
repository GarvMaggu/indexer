export declare class AskCancelActivity {
    static handleEvent(data: SellOrderCancelledEventData): Promise<void>;
}
export declare type SellOrderCancelledEventData = {
    orderId: string;
    contract: string;
    tokenId: string;
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
//# sourceMappingURL=ask-cancel-activity.d.ts.map