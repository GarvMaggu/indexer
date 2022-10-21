export declare class TransferActivity {
    static handleEvent(data: NftTransferEventData): Promise<void>;
}
export declare type NftTransferEventData = {
    contract: string;
    tokenId: string;
    fromAddress: string;
    toAddress: string;
    amount: number;
    transactionHash: string;
    logIndex: number;
    batchIndex: number;
    blockHash: string;
    timestamp: number;
};
//# sourceMappingURL=transfer-activity.d.ts.map