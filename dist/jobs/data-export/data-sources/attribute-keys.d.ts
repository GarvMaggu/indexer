import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class AttributeKeysDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: any;
            collection_id: any;
            key: any;
            kind: any;
            rank: any;
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
//# sourceMappingURL=attribute-keys.d.ts.map