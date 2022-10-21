"use strict";
// TODO: The initial idea was to have common methods for mapping events
// to underlying database tables together with any additional processes
// like changing order statuses given those events (eg. mark the orders
// as filled/cancelled). However, the minor differences in handling the
// different exchanges made these common methods quite messy. We should
// still have common methods when that's the case, but we should derive
// the logic into an exchange-specific method when the behaviour is too
// different from the common case.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonceCancels = exports.nftTransfers = exports.nftApprovals = exports.ftTransfers = exports.fills = exports.cancels = exports.bulkCancels = void 0;
exports.bulkCancels = __importStar(require("@/events-sync/storage/bulk-cancel-events"));
exports.cancels = __importStar(require("@/events-sync/storage/cancel-events"));
exports.fills = __importStar(require("@/events-sync/storage/fill-events"));
exports.ftTransfers = __importStar(require("@/events-sync/storage/ft-transfer-events"));
exports.nftApprovals = __importStar(require("@/events-sync/storage/nft-approval-events"));
exports.nftTransfers = __importStar(require("@/events-sync/storage/nft-transfer-events"));
exports.nonceCancels = __importStar(require("@/events-sync/storage/nonce-cancel-events"));
//# sourceMappingURL=index.js.map