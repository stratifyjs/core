import type { FastifyInstance } from "fastify";
import type { ProviderAny } from "../providers";

export type AccessFastifyCallback<Providers extends ProvidersMap> = (ctx: {
  fastify: FastifyInstance;
  deps: {
    [K in keyof Providers]: Awaited<ReturnType<Providers[K]["expose"]>>;
  };
}) => unknown | Promise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleAny = ModuleDef<any, any>;
export type ProvidersMap = Readonly<Record<string, ProviderAny>>;
export type SubModulesMap = ReadonlyArray<ModuleAny>;

export interface ModuleDef<
  Providers extends ProvidersMap,
  SubModules extends SubModulesMap,
> {
  name: string;
  deps: Providers;
  subModules: SubModules;
  encapsulate: boolean;
  accessFastify?: AccessFastifyCallback<Providers>;
  withProviders(
    updater: (deps: Providers) => Providers,
  ): ModuleDef<Providers, SubModules>;
  _mod?: never;
}

export type ModuleOptions<
  Providers extends ProvidersMap,
  SubModules extends SubModulesMap,
> = {
  name: string;
  deps?: Providers;
  subModules?: SubModules;
  encapsulate?: boolean;
  accessFastify?: AccessFastifyCallback<Providers>;
};
