import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class AsksDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: any;
            kind: any;
            status: any;
            contract: string;
            token_id: any;
            maker: string;
            taker: string;
            price: any;
            currency_address: string;
            currency_symbol: string | undefined;
            currency_price: any;
            start_price: any;
            end_price: any;
            dynamic: any;
            quantity: number;
            quantity_filled: number;
            quantity_remaining: number;
            valid_from: number;
            valid_until: number;
            nonce: number;
            source: string | undefined;
            fee_bps: number;
            expiration: number;
            raw_data: any;
            created_at: string;
            updated_at: string;
        }[];
        nextCursor: {
            id: any;
            updatedAt: any;
        };
    } | {
        data: never[];
        nextCursor: null;
    }>;
}
declare type CursorInfo = {
    id: number;
    updatedAt: string;
};
export {};
//# sourceMappingURL=asks.d.ts.map