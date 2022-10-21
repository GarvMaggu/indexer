import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class TokenAttributesDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: string;
            contract: string;
            token_id: any;
            attribute_id: any;
            collection_id: any;
            key: any;
            value: any;
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
    contract: string;
    tokenId: number;
    attributeId: number;
    updatedAt: string;
};
declare type RemovalsCursorInfo = {
    contract: string;
    tokenId: number;
    attributeId: number;
    deletedAt: string;
};
declare type CursorInfo = {
    updates?: UpdatesCursorInfo;
    removals?: RemovalsCursorInfo;
};
export {};
//# sourceMappingURL=token-attributes.d.ts.map