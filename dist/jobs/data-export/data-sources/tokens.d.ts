import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class TokensDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: string;
            contract: string;
            token_id: any;
            name: any;
            description: any;
            collection_id: any;
            owner: string | null;
            floor_ask_id: any;
            floor_ask_value: any;
            floor_ask_maker: string | null;
            floor_ask_valid_from: any;
            floor_ask_valid_to: any;
            floor_ask_source: string | undefined;
            last_sale_value: any;
            last_sale_timestamp: any;
            created_at: string;
            updated_at: string;
        }[];
        nextCursor: {
            contract: string;
            tokenId: any;
            updatedAt: any;
        };
    } | {
        data: never[];
        nextCursor: null;
    }>;
}
declare type CursorInfo = {
    contract: string;
    tokenId: number;
    updatedAt: string;
};
export {};
//# sourceMappingURL=tokens.d.ts.map