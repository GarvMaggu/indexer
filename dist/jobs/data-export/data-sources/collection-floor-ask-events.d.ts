import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class CollectionFloorAskEventsDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: any;
            kind: any;
            collection_id: any;
            contract: string;
            token_id: any;
            order_id: any;
            maker: string | null;
            price: any;
            previous_price: any;
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
//# sourceMappingURL=collection-floor-ask-events.d.ts.map