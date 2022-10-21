export declare type Transaction = {
    hash: string;
    from: string;
    to: string;
    value: string;
    data: string;
    blockNumber: number;
    blockTimestamp: number;
    gasPrice?: string;
    gasUsed?: string;
    gasFee?: string;
};
export declare const saveTransaction: (transaction: Transaction) => Promise<Transaction>;
export declare const getTransaction: (hash: string) => Promise<Pick<Transaction, "hash" | "from" | "to" | "value" | "data">>;
//# sourceMappingURL=index.d.ts.map