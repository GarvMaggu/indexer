import { StaticJsonRpcProvider, WebSocketProvider } from "@ethersproject/providers";
import Arweave from "arweave";
export declare const baseProvider: StaticJsonRpcProvider;
export declare const safeWebSocketSubscription: (callback: (provider: WebSocketProvider) => Promise<void>) => void;
export declare const arweaveGateway: Arweave;
//# sourceMappingURL=provider.d.ts.map