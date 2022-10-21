import { Log } from "@ethersproject/abstract-provider";
export declare type TransactionLogs = {
    hash: string;
    logs: Log[];
};
export declare const saveTransactionLogs: (transactionLogs: TransactionLogs) => Promise<TransactionLogs>;
export declare const getTransactionLogs: (hash: string) => Promise<TransactionLogs>;
//# sourceMappingURL=index.d.ts.map