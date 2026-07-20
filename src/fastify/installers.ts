import type { FastifyInstance } from "fastify";
import type { ProvidersMap } from "../providers/providers.types";
import type { Container } from "../../src/container/container";
import { resolveProviderMap } from "../modules/module";
import type { ModuleContext } from "../modules/module.types";
import type { InstallerOptions, InstallerConfig } from "./installers.types";

export function createInstaller<Providers extends ProvidersMap>(
  options: InstallerOptions<Providers>,
): InstallerConfig<Providers> {
  const { deps = {} as Providers, name = "unknown", install } = options;

  return {
    deps,
    name,
    install,
    async register(
      fastify: FastifyInstance,
      container: Container,
      ctx: ModuleContext,
    ) {
      const providerMap = await resolveProviderMap(container, deps, ctx);
      await install({
        fastify,
        deps: providerMap as never,
        container,
        moduleName: ctx.name,
      });
    },
  };
}
