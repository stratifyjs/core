import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Container } from "../container/container";
import {
  ModuleAny,
  ModuleContext,
  ModuleDef,
  ModuleOptions,
  SubModulesMap,
} from "./module.types";
import { ProvidersMap } from "../providers";
import { AdapterCache } from "../fastify";

const kModuleId = Symbol("fastify-dependency-injection:moduleId");
let __seq = 0;
const nextId = () => `m${++__seq}`;

/**
 * This is not a predictible id.
 */
export function getModuleId(mod: ModuleAny): string {
  return (mod as never)[kModuleId];
}

export function createModule<const SubModules extends SubModulesMap>(
  def: ModuleOptions<SubModules>,
): ModuleDef<SubModules> {
  const self = {
    name: def.name,
    subModules: (def.subModules ?? []) as SubModules,
    encapsulate: def.encapsulate ?? true,
    installers: def.installers ?? [],
    controllers: def.controllers ?? [],
    bindings: def.bindings ?? [],
    hooks: def.hooks ?? [],
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
    const ctx = {
      name: mod.name,
      bindings: mod.bindings,
    };
    const adapterCache: AdapterCache = new WeakMap();
    if (Array.isArray(mod.hooks)) {
      for (const hookConfig of mod.hooks) {
        await hookConfig.register(instance, container, ctx, adapterCache);
      }
    }

    if (Array.isArray(mod.installers)) {
      for (const config of mod.installers) {
        await config.register(instance, container, ctx);
      }
    }

    if (Array.isArray(mod.controllers)) {
      for (const config of mod.controllers) {
        await config.register(instance, container, ctx, adapterCache);
      }
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
  ctx: ModuleContext,
) {
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(map)) {
    out[k] = await container.get(p, ctx); // return always a new instance if transiant
  }

  return out;
}
