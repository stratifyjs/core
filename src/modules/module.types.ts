import type { FastifyInstance } from "fastify";
import type { ProviderAny } from "../providers";
import { RoutesBuilder } from "./routes/routes-builder";
import { HttpHooksBuilder } from "../hooks/hooks-builder";

type ExposeDeps<Providers extends ProvidersMap> = {
  [K in keyof Providers]: Awaited<ReturnType<Providers[K]["expose"]>>;
}

export type AccessFastifyCallback<Providers extends ProvidersMap> = (ctx: {
  fastify: FastifyInstance;
  deps: ExposeDeps<Providers>;
}) => unknown | Promise<unknown>;

export type RoutesCallback<Providers extends ProvidersMap> = (ctx: {
  builder: RoutesBuilder;
  deps: ExposeDeps<Providers>;
}) => unknown | Promise<unknown>;

export type HttpHooksCallback<Providers extends ProvidersMap> = (ctx: {
  builder: HttpHooksBuilder;
  deps: ExposeDeps<Providers>;
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
  routes?: RoutesCallback<Providers>;
  httpHooks?: HttpHooksCallback<Providers>;
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
  routes?: RoutesCallback<Providers>;
  httpHooks?: HttpHooksCallback<Providers>;
};
