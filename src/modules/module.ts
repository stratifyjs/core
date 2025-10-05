import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { ProviderAny } from "../providers/providers";
import type { Container } from "../container/container";
import { deepClone } from "../utils/deep-clone";

export type ProviderValues<
  Providers extends Readonly<Record<string, ProviderAny>>,
> = {
  [K in keyof Providers]: Awaited<ReturnType<Providers[K]["expose"]>>;
};

export interface ModuleDef<
  Providers extends Readonly<Record<string, ProviderAny>> = Readonly<
    Record<string, ProviderAny>
  >,
  SubModules extends ReadonlyArray<ModuleAny> = ReadonlyArray<ModuleAny>,
> {
  name: string;
  deps: Providers;
  subModules: SubModules;
  encapsulate: boolean;
  accessFastify?: (ctx: {
    fastify: FastifyInstance;
    deps: {
      [K in keyof Providers]: Awaited<ReturnType<Providers[K]["expose"]>>;
    };
  }) => unknown | Promise<unknown>;
  withProviders(
    updater: (deps: Providers) => Providers,
  ): ModuleDef<Providers, SubModules>;
  _mod?: never;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModuleAny = ModuleDef<any, any>;

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
  const Providers extends Readonly<Record<string, ProviderAny>>,
  const SubModules extends ReadonlyArray<ModuleAny>,
>(def: {
  name: string;
  deps?: Providers;
  subModules?: SubModules;
  encapsulate?: boolean;
  accessFastify?: (ctx: {
    fastify: FastifyInstance;
    deps: {
      [K in keyof Providers]: Awaited<ReturnType<Providers[K]["expose"]>>;
    };
  }) => unknown | Promise<unknown>;
}): ModuleDef<Providers, SubModules> {
  const self = {
    name: def.name,
    deps: (def.deps ?? {}) as Providers,
    subModules: (def.subModules ?? []) as SubModules,
    encapsulate: def.encapsulate ?? true,
    accessFastify: def.accessFastify,
    withProviders(
      updater: (deps: Providers) => Providers,
    ): ModuleDef<Providers, SubModules> {
      return createModule<Providers, SubModules>({
        name: self.name,
        deps: updater(deepClone(self.deps)),
        subModules: deepClone(self.subModules),
        encapsulate: self.encapsulate,
        accessFastify: self.accessFastify,
      })
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
    const localValues = await resolveProviderMap(container, mod.deps);
    if (mod.accessFastify) {
      await mod.accessFastify({ fastify: instance, deps: localValues });
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

async function resolveProviderMap(
  container: Container,
  map: Readonly<Record<string, ProviderAny>>,
) {
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(map)) {
    out[k] = await container.get(p); // return always a new instance if transiant
  }

  return out;
}
