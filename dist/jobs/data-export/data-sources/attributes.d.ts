import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class AttributesDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: any;
            attribute_key_id: any;
            value: any;
            token_count: number;
            on_sale_count: number;
            floor_sell_value: number | null;
            sell_updated_at: string | null;
            collection_id: any;
            kind: any;
            key: any;
            created_at: string;
            updated_at: string;
            is_active: boolean;
        }[];
        nextCursor: {
            updates: UpdatesCursorInfo | undefined;
            removals: RemovalsCursorInfo | undefined;
        };
    } | {
        data: never[];
        nextCursor: null;
    }>;
}
declare type UpdatesCursorInfo = {
    id: number;
    updatedAt: string;
};
declare type RemovalsCursorInfo = {
    id: number;
    deletedAt: string;
};
declare type CursorInfo = {
    updates?: UpdatesCursorInfo;
    removals?: RemovalsCursorInfo;
};
export {};
//# sourceMappingURL=attributes.d.ts.map