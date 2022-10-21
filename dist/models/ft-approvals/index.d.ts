export declare type FtApproval = {
    token: string;
    owner: string;
    spender: string;
    value: string;
};
export declare const saveFtApproval: (ftApproval: FtApproval) => Promise<FtApproval>;
export declare const getFtApproval: (token: string, owner: string, spender: string) => Promise<FtApproval | undefined>;
//# sourceMappingURL=index.d.ts.map