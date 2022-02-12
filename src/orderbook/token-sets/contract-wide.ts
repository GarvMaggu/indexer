import crypto from "crypto";
import stringify from "json-stable-stringify";

import { db, pgp } from "@/common/db";
import { logger } from "@/common/logger";
import { toBuffer } from "@/common/utils";

export type TokenSet = {
  id: string;
  schemaHash: string;
  schema?: any;
  contract: string;
};

const isValid = (tokenSet: TokenSet) => {
  try {
    if (tokenSet.id !== `contract:${tokenSet.contract}`) {
      return false;
    }

    if (tokenSet.schema) {
      // If we have the schema, then validate it against the schema hash
      const schemaHash =
        "0x" +
        crypto
          .createHash("sha256")
          .update(stringify(tokenSet.schema))
          .digest("hex");
      if (schemaHash !== tokenSet.schemaHash) {
        return false;
      }
    }
  } catch {
    return false;
  }

  return true;
};

export const save = async (tokenSets: TokenSet[]): Promise<TokenSet[]> => {
  const queries: any[] = [];

  const valid: TokenSet[] = [];
  for (const tokenSet of tokenSets) {
    if (!isValid(tokenSet)) {
      continue;
    }

    const { id, schemaHash, schema, contract } = tokenSet;
    try {
      queries.push({
        query: `
          INSERT INTO "token_sets" (
            "id",
            "schema_hash",
            "schema"
          ) VALUES (
            $/id/,
            $/schemaHash/,
            $/schema:json/
          )
          ON CONFLICT DO NOTHING
        `,
        values: {
          id,
          schemaHash: toBuffer(schemaHash),
          schema,
        },
      });

      // For efficiency, skip if data already exists
      const tokenSetTokensExist = await db.oneOrNone(
        `
          SELECT 1 FROM "token_sets_tokens" "tst"
          WHERE "tst"."token_set_id" = $/tokenSetId/
          LIMIT 1
        `,
        { tokenSetId: id }
      );
      if (!tokenSetTokensExist) {
        queries.push({
          query: `
            INSERT INTO "token_sets_tokens" (
              "token_set_id",
              "contract",
              "token_id"
            ) (
              SELECT
                $/tokenSetId/,
                $/contract/,
                "t"."token_id"
              FROM "tokens" "t"
              WHERE "t"."contract" = $/contract/
            )
            ON CONFLICT DO NOTHING
          `,
          values: {
            tokenSetId: tokenSet.id,
            contract: toBuffer(contract),
          },
        });
      }

      valid.push(tokenSet);
    } catch (error) {
      logger.error(
        "orderbook-contract-wide-set",
        `Failed to check/save token set ${JSON.stringify(tokenSet)}: ${error}`
      );
    }
  }

  if (queries.length) {
    await db.none(pgp.helpers.concat(queries));
  }

  return valid;
};