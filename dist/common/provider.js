"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arweaveGateway = exports.safeWebSocketSubscription = exports.baseProvider = void 0;
const providers_1 = require("@ethersproject/providers");
const arweave_1 = __importDefault(require("arweave"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
// Use a static provider to avoid redundant `eth_chainId` calls
exports.baseProvider = new providers_1.StaticJsonRpcProvider(index_1.config.baseNetworkHttpUrl, index_1.config.chainId);
// https://github.com/ethers-io/ethers.js/issues/1053#issuecomment-808736570
const safeWebSocketSubscription = (callback) => {
    const webSocketProvider = new providers_1.WebSocketProvider(index_1.config.baseNetworkWsUrl);
    webSocketProvider.on("error", (error) => {
        logger_1.logger.error("websocket-provider", `WebSocket subscription failed: ${error}`);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webSocketProvider._websocket.on("error", (error) => {
        logger_1.logger.error("websocket-provider", `WebSocket subscription failed: ${error}`);
    });
    let pingTimeout;
    let keepAliveInterval;
    const EXPECTED_PONG_BACK = 15000;
    const KEEP_ALIVE_CHECK_INTERVAL = 7500;
    webSocketProvider._websocket.on("open", async () => {
        keepAliveInterval = setInterval(() => {
            webSocketProvider._websocket.ping();
            pingTimeout = setTimeout(() => {
                webSocketProvider._websocket.terminate();
            }, EXPECTED_PONG_BACK);
        }, KEEP_ALIVE_CHECK_INTERVAL);
        await callback(webSocketProvider);
    });
    webSocketProvider._websocket.on("close", () => {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
        }
        if (pingTimeout) {
            clearTimeout(pingTimeout);
        }
        (0, exports.safeWebSocketSubscription)(callback);
    });
    webSocketProvider._websocket.on("pong", () => {
        if (pingTimeout) {
            clearInterval(pingTimeout);
        }
    });
};
exports.safeWebSocketSubscription = safeWebSocketSubscription;
exports.arweaveGateway = arweave_1.default.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
});
//# sourceMappingURL=provider.js.map