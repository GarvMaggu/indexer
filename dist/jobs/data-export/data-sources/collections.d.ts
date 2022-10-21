import { BaseDataSource } from "@/jobs/data-export/data-sources/index";
export declare class CollectionsDataSource extends BaseDataSource {
    getSequenceData(cursor: CursorInfo | null, limit: number): Promise<{
        data: {
            id: any;
            slug: any;
            name: any;
            description: any;
            token_count: string;
            contract: string;
            day1_rank: any;
            day7_rank: any;
            day30_rank: any;
            all_time_rank: any;
            day1_volume: any;
            day7_volume: any;
            day30_volume: any;
            all_time_volume: any;
            day1_volume_change: any;
            day7_volume_change: any;
            day30_volume_change: any;
            floor_ask_value: any;
            day1_floor_sale_value: any;
            day7_floor_sale_value: any;
            day30_floor_sale_value: any;
            day1_floor_sale_change: number | null;
            day7_floor_sale_change: number | null;
            day30_floor_sale_change: number | null;
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
//# sourceMappingURL=collections.d.ts.map