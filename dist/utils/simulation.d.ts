import { BigNumberish } from "@ethersproject/bignumber";
import { TxData } from "@reservoir0x/sdk/dist/utils";
export declare const genericTaker = "0x0000000000000000000000000000000000000001";
export declare const ensureBuyTxSucceeds: (token: {
    kind: "erc721" | "erc1155";
    contract: string;
    tokenId: BigNumberish;
    amount: BigNumberish;
}, tx: TxData) => Promise<boolean>;
//# sourceMappingURL=simulation.d.ts.map