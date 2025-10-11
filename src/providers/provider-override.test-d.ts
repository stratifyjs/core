import { expectError, expectType } from "tsd";
import {
  createProvider,
  ProviderContract,
  ProviderDef,
} from "..";

interface Db {
  url: string;
}

type DbContract = ProviderContract<Db>;

const db: DbContract = createProvider({
  name: "db",
  expose: () => ({ url: "real" }),
});

const repo = createProvider({
  name: "repo",
  deps: { db },
  expose: ({ db }) => db.url,
});

const repoDouble = repo.withProviders((deps) => ({
  ...deps,
  db, // reuse db, or swap with another DbContract
}));

expectType<
  ProviderDef<
    {
      readonly db: DbContract;
    },
    string
  >
>(repo);

expectType<
  ProviderDef<
    {
      readonly db: DbContract;
    },
    string
  >
>(repoDouble);

expectError(repo.withProviders((deps) => ({ ...deps, db: 1 })));
