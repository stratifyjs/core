import type { FastifyInstance } from "fastify";
import { RoutesBuilder } from "../routes/routes-builder";
import { HttpHooksBuilder } from "../hooks/http-hooks-builder";
import { AppHooksBuilder, AppHooksConfig, HttpHooksConfig } from "../hooks";
import { ExposeDeps, ProvidersMap } from "../providers";

export type AccessFastifyCallback<Providers extends ProvidersMap> = (ctx: {
  fastify: FastifyInstance;
  deps: ExposeDeps<Providers>;
}) => unknown | Promise<unknown>;

export type RoutesBuilderCallback<
  Providers extends ProvidersMap = ProvidersMap,
> = (ctx: {
  builder: RoutesBuilder;
  deps: ExposeDeps<Providers>;
}) => unknown | Promise<unknown>;

export type HttpHooksBuilderCallback<Providers extends ProvidersMap> = (ctx: {
  builder: HttpHooksBuilder;
  deps: ExposeDeps<Providers>;
}) => unknown | Promise<unknown>;

export type ApplicationHooksBuilderCallback<Providers extends ProvidersMap> =
  (ctx: {
    builder: AppHooksBuilder;
    deps: ExposeDeps<Providers>;
  }) => unknown | Promise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleAny = ModuleDef<any, any>;
export type SubModulesMap = ReadonlyArray<ModuleAny>;

export interface ModuleDef<
  Providers extends ProvidersMap,
  SubModules extends SubModulesMap,
> {
  name: string;
  deps: Providers;
  subModules: SubModules;
  encapsulate: boolean;
  fastifyInstaller?: AccessFastifyCallback<Providers>;
  routes?: RoutesBuilderCallback<Providers>;
  hooks?: (AppHooksConfig<Providers> | HttpHooksConfig<Providers>)[];
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
  fastifyInstaller?: AccessFastifyCallback<Providers>;
  routes?: RoutesBuilderCallback<Providers>;
  hooks?: (AppHooksConfig<Providers> | HttpHooksConfig<Providers>)[];
};
