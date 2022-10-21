export declare type TokenSet = {
    id: string;
    schemaHash: string;
    schema?: object;
    contract: string;
    tokenId: string;
};
export declare const save: (tokenSets: TokenSet[]) => Promise<TokenSet[]>;
//# sourceMappingURL=single-token.d.ts.map