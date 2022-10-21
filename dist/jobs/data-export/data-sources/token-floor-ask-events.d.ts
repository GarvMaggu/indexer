import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class TokenFloorAskEventsDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: any;
            kind: any;
            contract: string;
            token_id: any;
            order_id: any;
            maker: string | null;
            price: any;
            previous_price: any;
            nonce: any;
            valid_from: number | null;
            valid_until: number | null;
            source: string | undefined;
            tx_hash: string | null;
            tx_timestamp: number | null;
            created_at: string;
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
};
export {};
//# sourceMappingURL=token-floor-ask-events.d.ts.map