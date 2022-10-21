import moduleAlias from "module-alias";
moduleAlias.addAliases({
  "@/api": `${__dirname}/api`,
  "@/arweave-sync": `${__dirname}/sync/arweave`,
  "@/common": `${__dirname}/common`,
  "@/config": `${__dirname}/config`,
  "@/models": `${__dirname}/models`,
  "@/utils": `${__dirname}/utils`,
  "@/jobs": `${__dirname}/jobs`,
  "@/orderbook": `${__dirname}/orderbook`,
  "@/events-sync": `${__dirname}/sync/events`,
  "@/pubsub": `${__dirname}/pubsub`,
});

import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();
