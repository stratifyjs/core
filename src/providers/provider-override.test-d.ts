import { expectError, expectType } from "tsd";
import {
  createModule,
  createProvider,
  ModuleAny,
  ModuleDef,
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

const usersModule = createModule({
  name: "users",
  deps: { repo },
});

const usersModuleDouble = usersModule.withProviders((providers) => ({
  ...providers,
  repo,
}));

expectType<
  ModuleDef<
    {
      readonly repo: ProviderDef<
        {
          readonly db: DbContract;
        },
        string
      >;
    },
    readonly ModuleAny[]
  >
>(usersModule);

expectType<
  ModuleDef<
    {
      readonly repo: ProviderDef<
        {
          readonly db: DbContract;
        },
        string
      >;
    },
    readonly ModuleAny[]
  >
>(usersModuleDouble);

expectError(
  usersModule.withProviders((providers) => ({
    ...providers,
    repo: 123,
  })),
);
