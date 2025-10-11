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

export function createHooks<Providers extends ProvidersMap>(
  options: HttpHooksOptions<Providers>,
): HttpHooksConfig<Providers>;

export function createHooks<Providers extends ProvidersMap>(
  options: AppHooksOptions<Providers>,
): AppHooksConfig<Providers>;

export function createHooks<Providers extends ProvidersMap>(
  options: HttpHooksOptions<Providers> | AppHooksOptions<Providers>,
) {
  const { type, deps = {}, build } = options;

  return {
    type,
    deps,
    build,
    async registerHooks(
      fastify: FastifyInstance,
      container: Container,
      moduleName: string,
    ) {
      const providerMap = await resolveProviderMap(container, deps as never);
      const hookBuilder =
        type === "http"
          ? new HttpHooksBuilder(moduleName)
          : new AppHooksBuilder(moduleName);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (build as any)({ builder: hookBuilder, deps: providerMap });
      hookBuilder.register(fastify);
    },
  };
}
