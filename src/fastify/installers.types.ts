import type { FastifyInstance } from "fastify";
import type { ProvidersMap, ExposeDeps } from "../../src/providers";
import type { Container } from "../../src/container/container";
import { ModuleContext } from "../modules";

/**
 * Installer builder callback.
 * Called when module is registered, after hooks and before controllers.
 */
export type InstallerBuilderCallback<
  Providers extends ProvidersMap = ProvidersMap,
> = (ctx: {
  fastify: FastifyInstance;
  deps: ExposeDeps<Providers>;
  container: Container;
  moduleName: string;
}) => unknown | Promise<unknown>;

export interface InstallerOptions<Providers extends ProvidersMap> {
  deps?: Providers;
  name?: string;
  install: InstallerBuilderCallback<Providers>;
}

export interface InstallerConfig<Providers extends ProvidersMap> {
  deps: Providers;
  name: string;
  install: InstallerBuilderCallback<Providers>;
  register(
    fastify: FastifyInstance,
    container: Container,
    ctx: ModuleContext,
  ): Promise<void>;
}
