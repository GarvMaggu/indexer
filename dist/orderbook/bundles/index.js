"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = void 0;
const db_1 = require("@/common/db");
const create = async (tokenSets, metadata) => {
    const newBundleResult = await db_1.idb.oneOrNone(`
      INSERT INTO bundles (metadata) VALUES ($/metadata/)
      RETURNING bundles.id
    `, { metadata });
    if (!newBundleResult) {
        throw new Error("Could not create bundle");
    }
    const columns = new db_1.pgp.helpers.ColumnSet(["bundle_id", "kind", "token_set_id"], {
        table: "bundle_items",
    });
    const values = tokenSets.map(({ kind, id }) => ({
        bundle_id: newBundleResult.id,
        kind,
        token_set_id: id,
    }));
    await db_1.idb.none(`
      INSERT INTO bundle_items (
        bundle_id,
        kind,
        token_set_id
      ) VALUES ${db_1.pgp.helpers.values(values, columns)}
    `);
    return newBundleResult.id;
};
exports.create = create;
//# sourceMappingURL=index.js.map