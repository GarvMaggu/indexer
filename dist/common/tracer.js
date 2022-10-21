"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dd_trace_1 = __importDefault(require("dd-trace"));
const network_1 = require("@/config/network");
if (process.env.DATADOG_AGENT_URL) {
    const service = (0, network_1.getServiceName)();
    dd_trace_1.default.init({
        profiling: true,
        logInjection: true,
        runtimeMetrics: true,
        service,
        url: process.env.DATADOG_AGENT_URL,
    });
}
exports.default = dd_trace_1.default;
//# sourceMappingURL=tracer.js.map