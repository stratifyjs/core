import type { FastifyInstance } from "fastify";
import { ExposeDeps, ProvidersMap } from "../providers";
import { AppHooksConfig, HttpHooksConfig } from "../hooks";
import { ControllerConfig } from "../controllers";

export type AccessFastifyCallback<Providers extends ProvidersMap> = (ctx: {
  fastify: FastifyInstance;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers?: ControllerConfig<any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hooks?: (AppHooksConfig<any> | HttpHooksConfig<any>)[];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers?: ControllerConfig<any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hooks?: (AppHooksConfig<any> | HttpHooksConfig<any>)[];
};
