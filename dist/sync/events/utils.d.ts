import { SourcesEntity } from "@/models/sources/sources-entity";
import { OrderKind } from "@/orderbook/orders";
export declare const fetchBlock: (blockNumber: number, force?: boolean) => Promise<import("@/models/blocks").Block>;
export declare const fetchTransaction: (txHash: string) => Promise<import("@/models/transactions").Transaction | Pick<import("@/models/transactions").Transaction, "data" | "hash" | "to" | "from" | "value">>;
export declare const fetchTransactionTrace: (txHash: string) => Promise<import("@/models/transaction-traces").TransactionTrace | undefined>;
export declare const fetchTransactionLogs: (txHash: string) => Promise<import("@/models/transaction-logs").TransactionLogs>;
export declare const extractAttributionData: (txHash: string, orderKind: OrderKind, address?: string | undefined) => Promise<{
    orderSource: SourcesEntity | undefined;
    fillSource: SourcesEntity | undefined;
    aggregatorSource: SourcesEntity | undefined;
    taker: string | undefined;
}>;
//# sourceMappingURL=utils.d.ts.map