import type { FastifyInstance } from "fastify";
import type { ProvidersMap } from "../../src/providers";
import type { Container } from "../../src/container/container";
import { resolveProviderMap } from "../../src/modules";
import type {
  InstallerOptions,
  InstallerConfig,
} from "./installers.types";

export function createInstaller<Providers extends ProvidersMap>(
  options: InstallerOptions<Providers>,
): InstallerConfig<Providers> {
  const { deps = {} as Providers, name = 'unknown', install } = options;

  return {
    deps,
    name,
    install,
    async register(
      fastify: FastifyInstance,
      container: Container,
      moduleName: string,
    ) {
      const providerMap = await resolveProviderMap(container, deps);
      await install({
        fastify,
        deps: providerMap as never,
        container,
        moduleName,
      });
    },
  };
}
