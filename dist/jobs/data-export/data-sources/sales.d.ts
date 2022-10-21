import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class SalesDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: string;
            contract: string;
            token_id: any;
            order_id: any;
            order_kind: any;
            order_side: string;
            order_source: string | null;
            from: string;
            to: string;
            price: any;
            usd_price: any;
            currency_address: string;
            currency_symbol: string | undefined;
            currency_price: any;
            amount: number;
            fill_source: string | undefined;
            aggregator_source: string | undefined;
            wash_trading_score: number;
            is_primary: boolean;
            tx_hash: string;
            tx_log_index: any;
            tx_batch_index: any;
            tx_timestamp: any;
            created_at: string;
            updated_at: string;
        }[];
        nextCursor: {
            updatedAt: any;
            txHash: string;
            logIndex: any;
            batchIndex: any;
        };
    } | {
        data: never[];
        nextCursor: null;
    }>;
}
declare type CursorInfo = {
    updatedAt: string;
    txHash: string;
    logIndex: number;
    batchIndex: string;
};
export {};
//# sourceMappingURL=sales.d.ts.map