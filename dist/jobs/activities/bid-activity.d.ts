export declare class BidActivity {
    static handleEvent(data: NewBuyOrderEventData): Promise<void>;
}
export declare type NewBuyOrderEventData = {
    orderId: string;
    contract: string;
    maker: string;
    price: number;
    amount: number;
    timestamp: number;
    orderSourceIdInt: number;
};
//# sourceMappingURL=bid-activity.d.ts.map