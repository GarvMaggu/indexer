"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redb = exports.hdb = exports.idb = exports.edb = exports.pgp = void 0;
const pg_promise_1 = __importDefault(require("pg-promise"));
const index_1 = require("@/config/index");
exports.pgp = (0, pg_promise_1.default)();
// Database connection for external public-facing APIs
exports.edb = (0, exports.pgp)({
    connectionString: index_1.config.databaseUrl,
    keepAlive: true,
    max: 60,
    connectionTimeoutMillis: 10 * 1000,
    query_timeout: 10 * 1000,
    statement_timeout: 10 * 1000,
    allowExitOnIdle: true,
});
// Database connection for internal processes/APIs
exports.idb = (0, exports.pgp)({
    connectionString: index_1.config.databaseUrl,
    keepAlive: true,
    max: 60,
    connectionTimeoutMillis: 30 * 1000,
    query_timeout: 5 * 60 * 1000,
    statement_timeout: 5 * 60 * 1000,
    allowExitOnIdle: true,
});
// Database connection for health checks
exports.hdb = (0, exports.pgp)({
    connectionString: index_1.config.databaseUrl,
    keepAlive: true,
    max: 5,
    connectionTimeoutMillis: 30 * 1000,
    query_timeout: 10 * 1000,
    statement_timeout: 10 * 1000,
    allowExitOnIdle: true,
});
// Database connection for external public-facing APIs using a read replica DB
exports.redb = (0, exports.pgp)({
    connectionString: index_1.config.readReplicaDatabaseUrl,
    keepAlive: true,
    max: 60,
    connectionTimeoutMillis: 10 * 1000,
    query_timeout: 10 * 1000,
    statement_timeout: 10 * 1000,
    allowExitOnIdle: true,
});
//# sourceMappingURL=db.js.map