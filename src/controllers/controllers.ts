import type { ProvidersMap } from "../providers";
import { RoutesBuilder } from "./routes-builder";
import {
  ControllerConfig,
  ControllerOptions,
  resolveProviderMap,
} from "../modules";
import { AdapterMap, resolveAdapterMap } from "../fastify";

export function createController<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
>(
  options: ControllerOptions<Providers, Adaps>,
): ControllerConfig<Providers, Adaps> {
  const {
    deps = {} as Providers,
    name = "unknown",
    adaps = {} as Adaps,
    build,
  } = options;

  return {
    deps,
    adaps,
    name,
    build,
    async register(fastify, container, ctx, cache) {
      const providerMap = await resolveProviderMap(container, deps, ctx);
      const adapterMap = await resolveAdapterMap(
        fastify,
        adaps as never,
        cache,
      );

      const routesBuilder = new RoutesBuilder(ctx.name);
      await build({
        builder: routesBuilder,
        deps: providerMap as never,
        adaps: adapterMap,
      });

      for (const route of routesBuilder.getRoutes()) {
        fastify.route(route);
      }
    },
  };
}
