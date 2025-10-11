import type { ProvidersMap } from "../providers";
import { RoutesBuilder } from "./routes-builder";
import {
  ControllerConfig,
  ControllerOptions,
  resolveProviderMap,
} from "../modules";

export function createController<Providers extends ProvidersMap>(
  options: ControllerOptions<Providers>,
): ControllerConfig<Providers> {
  const { deps = {} as Providers, build } = options;

  return {
    deps,
    build,
    async registerRoutes(fastify, container) {
      const providerMap = await resolveProviderMap(container, deps);
      const routesBuilder = new RoutesBuilder();
      await build({ builder: routesBuilder, deps: providerMap as never });
      routesBuilder.register(fastify);
    },
  };
}
