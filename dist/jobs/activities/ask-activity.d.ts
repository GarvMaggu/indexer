export declare class AskActivity {
    static handleEvent(data: NewSellOrderEventData): Promise<void>;
}
export declare type NewSellOrderEventData = {
    orderId: string;
    contract: string;
    tokenId: string;
    maker: string;
    price: number;
    amount: number;
    timestamp: number;
    orderSourceIdInt: number;
};
//# sourceMappingURL=ask-activity.d.ts.map