"use strict";
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
exports.fetchAndUpdateFtApproval = void 0;
const sdk_1 = require("@reservoir0x/sdk");
const provider_1 = require("@/common/provider");
const ftApprovalsModel = __importStar(require("@/models/ft-approvals"));
const fetchAndUpdateFtApproval = async (token, owner, spender) => {
    const erc20 = new sdk_1.Common.Helpers.Erc20(provider_1.baseProvider, token);
    const allowance = await erc20.getAllowance(owner, spender).then((b) => b.toString());
    return ftApprovalsModel.saveFtApproval({
        token,
        owner,
        spender,
        value: allowance,
    });
};
exports.fetchAndUpdateFtApproval = fetchAndUpdateFtApproval;
//# sourceMappingURL=on-chain-data.js.map