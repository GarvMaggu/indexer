export declare type RefreshTokens = {
    collection: string;
    contract: string;
    tokenId: string;
};
/**
 * Class that manage redis list of tokens, pending metadata refresh
 */
export declare class PendingRefreshTokens {
    key: string;
    constructor(method: string);
    add(refreshToken: RefreshTokens[], prioritized?: boolean): Promise<number>;
    get(count?: number): Promise<RefreshTokens[]>;
}
//# sourceMappingURL=index.d.ts.map