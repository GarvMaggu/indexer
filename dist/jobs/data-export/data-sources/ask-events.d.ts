import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class AskEventsDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: any;
            kind: any;
            status: any;
            contract: string;
            token_id: any;
            order_id: any;
            maker: string | null;
            price: any;
            quantity_remaining: number;
            valid_from: number | null;
            valid_until: number | null;
            source: string | undefined;
            tx_hash: string | null;
            tx_timestamp: number | null;
            created_at: string;
        }[];
        nextCursor: {
            id: any;
        };
    } | {
        data: never[];
        nextCursor: null;
    }>;
}
declare type CursorInfo = {
    id: number;
};
export {};
//# sourceMappingURL=ask-events.d.ts.map