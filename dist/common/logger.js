"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = require("winston");
const network_1 = require("@/config/network");
const os_1 = require("os");
/* eslint-disable @typescript-eslint/no-explicit-any */
const nets = (0, os_1.networkInterfaces)();
/* eslint-disable @typescript-eslint/no-explicit-any */
const results = {};
for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === "IPv4" && !net.internal) {
            if (!results[name]) {
                results[name] = [];
            }
            results[name].push(net.address);
        }
    }
}
const log = (level) => {
    const service = (0, network_1.getServiceName)();
    const logger = (0, winston_1.createLogger)({
        exitOnError: false,
        format: winston_1.format.combine(winston_1.format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }), winston_1.format.json()),
        transports: [
            process.env.DATADOG_API_KEY
                ? new winston_1.transports.Http({
                    host: "http-intake.logs.datadoghq.com",
                    path: `/api/v2/logs?dd-api-key=${process.env.DATADOG_API_KEY}&ddsource=nodejs&service=${service}`,
                    ssl: true,
                })
                : // Fallback to logging to standard output
                    new winston_1.transports.Console(),
        ],
    });
    return (component, message) => logger.log(level, message, {
        component,
        version: process.env.npm_package_version,
        networkInterfaces: results,
        railwaySnapshotId: process.env.RAILWAY_SNAPSHOT_ID,
    });
};
exports.logger = {
    error: log("error"),
    info: log("info"),
    warn: log("warn"),
};
//# sourceMappingURL=logger.js.map