import { CallTrace } from "@georgeroman/evm-tx-simulator/dist/types";
export declare type TransactionTrace = {
    hash: string;
    calls: CallTrace;
};
export declare const saveTransactionTrace: (transactionTrace: TransactionTrace) => Promise<TransactionTrace>;
export declare const getTransactionTrace: (hash: string) => Promise<TransactionTrace>;
//# sourceMappingURL=index.d.ts.map