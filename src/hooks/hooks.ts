import { FastifyInstance } from "fastify";
import { ProvidersMap } from "../providers";
import {
  AppHooksConfig,
  AppHooksOptions,
  HttpHooksConfig,
  HttpHooksOptions,
} from "./hooks.types";
import { Container } from "../container/container";
import { HttpHooksBuilder } from "./http-hooks-builder";
import { AppHooksBuilder } from "./application-hooks-builder";
import { resolveProviderMap } from "../modules";
import { AdapterCache, AdapterMap, resolveAdapterMap } from "../fastify";

export function createHooks<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
>(
  options: HttpHooksOptions<Providers, Adaps>,
): HttpHooksConfig<Providers, Adaps>;

export function createHooks<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
>(options: AppHooksOptions<Providers, Adaps>): AppHooksConfig<Providers, Adaps>;

export function createHooks<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
>(
  options:
    | HttpHooksOptions<Providers, Adaps>
    | AppHooksOptions<Providers, Adaps>,
) {
  const { type, deps = {}, name = "unknown", adaps = {}, build } = options;

  return {
    type,
    deps,
    adaps,
    name,
    build,
    async register(
      fastify: FastifyInstance,
      container: Container,
      moduleName: string,
      cache: AdapterCache,
    ) {
      const providerMap = await resolveProviderMap(container, deps as never);
      const adapsMap = await resolveAdapterMap(fastify, adaps as never, cache);
      const hookBuilder =
        type === "http"
          ? new HttpHooksBuilder(moduleName)
          : new AppHooksBuilder(moduleName);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (build as any)({
        builder: hookBuilder,
        deps: providerMap,
        adaps: adapsMap,
      });
      hookBuilder.register(fastify);
    },
  };
}
