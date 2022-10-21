export declare abstract class BaseDataSource {
    abstract getSequenceData(cursor: Record<string, unknown> | null, limit: number): Promise<getSequenceDataResult>;
}
export declare type getSequenceDataResult = {
    data: Record<string, unknown>[];
    nextCursor: Record<string, unknown> | null;
};
//# sourceMappingURL=index.d.ts.map