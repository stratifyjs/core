import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Container } from "../container/container";
import { deepClone } from "../utils/deep-clone";
import {
  ModuleAny,
  ModuleDef,
  ModuleOptions,
  SubModulesMap,
} from "./module.types";
import { RoutesBuilder } from "../routes/routes-builder";
import { ProvidersMap } from "../providers";

const kModuleId = Symbol("fastify-dependency-injection:moduleId");
let __seq = 0;
const nextId = () => `m${++__seq}`;

/**
 * This is not a predictible id.
 */
export function getModuleId(mod: ModuleAny): string {
  return (mod as never)[kModuleId];
}

export function createModule<
  const Providers extends ProvidersMap,
  const SubModules extends SubModulesMap,
>(def: ModuleOptions<Providers, SubModules>): ModuleDef<Providers, SubModules> {
  const self = {
    name: def.name,
    deps: (def.deps ?? {}) as Providers,
    subModules: (def.subModules ?? []) as SubModules,
    encapsulate: def.encapsulate ?? true,
    fastifyInstaller: def.fastifyInstaller,
    routes: def.routes,
    hooks: def.hooks,
    withProviders(
      updater: (deps: Providers) => Providers,
    ): ModuleDef<Providers, SubModules> {
      return createModule<Providers, SubModules>({
        ...self,
        deps: updater(deepClone(self.deps)),
        subModules: deepClone(self.subModules),
      });
    },
  };

  Object.defineProperty(self, kModuleId, {
    value: nextId(),
    enumerable: false,
  });

  return self;
}

export async function registerModule(
  fastify: FastifyInstance,
  mod: ModuleAny,
  container: Container,
): Promise<void> {
  const plugin = async (instance: FastifyInstance) => {
    if (Array.isArray(mod.hooks)) {
      for (const hookConfig of mod.hooks) {
        await hookConfig.registerHooks(instance, container, mod.name);
      }
    }

    const localValues = await resolveProviderMap(container, mod.deps);
    if (mod.fastifyInstaller) {
      await mod.fastifyInstaller({ fastify: instance, deps: localValues });
    }

    if (mod.routes) {
      const builder = new RoutesBuilder();
      await mod.routes({ builder, deps: localValues });
      builder.register(instance);
    }

    for (const sub of mod.subModules) {
      await registerModule(instance, sub, container);
    }
  };

  await fastify.register(
    fp(plugin, {
      name: `mod:${mod.name}@${getModuleId(mod)}`,
      encapsulate: mod.encapsulate,
    }),
  );
}

export async function resolveProviderMap(
  container: Container,
  map: ProvidersMap,
) {
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(map)) {
    out[k] = await container.get(p); // return always a new instance if transiant
  }

  return out;
}
