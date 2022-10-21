import * as Sdk from "@reservoir0x/sdk";
export declare const offChainCheck: (order: Sdk.Seaport.Order, options?: {
    onChainApprovalRecheck?: boolean | undefined;
    checkFilledOrCancelled?: boolean | undefined;
} | undefined) => Promise<void>;
export declare const offChainCheckBundle: (order: Sdk.Seaport.BundleOrder, options?: {
    onChainApprovalRecheck?: boolean | undefined;
    checkFilledOrCancelled?: boolean | undefined;
} | undefined) => Promise<void>;
//# sourceMappingURL=check.d.ts.map