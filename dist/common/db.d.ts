import PgPromise from "pg-promise";
export declare const pgp: PgPromise.IMain<{}, import("pg-promise/typescript/pg-subset").IClient>;
export declare const edb: PgPromise.IDatabase<{}, import("pg-promise/typescript/pg-subset").IClient>;
export declare const idb: PgPromise.IDatabase<{}, import("pg-promise/typescript/pg-subset").IClient>;
export declare const hdb: PgPromise.IDatabase<{}, import("pg-promise/typescript/pg-subset").IClient>;
export declare const redb: PgPromise.IDatabase<{}, import("pg-promise/typescript/pg-subset").IClient>;
export declare type PgPromiseQuery = {
    query: string;
    values?: object;
};
//# sourceMappingURL=db.d.ts.map