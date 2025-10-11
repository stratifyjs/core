import type { FastifyInstance } from "fastify";
import { ExposeDeps, ProvidersMap } from "../providers";
import { AppHooksConfig, HttpHooksConfig } from "../hooks";
import { ControllerConfig } from "../controllers";
import { InstallerConfig } from "../fastify/installers.types";

export type AccessFastifyCallback<Providers extends ProvidersMap> = (ctx: {
  fastify: FastifyInstance;
  deps: ExposeDeps<Providers>;
}) => unknown | Promise<unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleAny = ModuleDef<any>;
export type SubModulesMap = ReadonlyArray<ModuleAny>;

export interface ModuleDef<
  SubModules extends SubModulesMap,
> {
  name: string;
  subModules: SubModules;
  encapsulate: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  installers?: InstallerConfig<any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers?: ControllerConfig<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hooks?: (AppHooksConfig<any, any> | HttpHooksConfig<any, any>)[];
  _mod?: never;
}

export type ModuleOptions<
  SubModules extends SubModulesMap,
> = {
  name: string;
  subModules?: SubModules;
  encapsulate?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  installers?: InstallerConfig<any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controllers?: ControllerConfig<any, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hooks?: (AppHooksConfig<any, any> | HttpHooksConfig<any, any>)[];
};
