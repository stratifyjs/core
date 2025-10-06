import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

export * from "./providers";
export * from "./modules";
export * from "./hooks";
export * from "./routes";

import { getProviderId, resolveDeps, type ProviderAny } from "./providers";
import { Container } from "./container/container";
import { describeTree } from "./printer/describe-tree";
import { getModuleId, ModuleAny, registerModule } from "./modules";

export interface CreateAppOptions {
  serverOptions?: FastifyServerOptions;
  root: ModuleAny;
}

declare module "fastify" {
  export interface FastifyInstance {
    describeTree: () => string;
  }
}

type InstancesMap = Map<string, string>;

export async function createApp({
  serverOptions,
  root,
}: CreateAppOptions): Promise<FastifyInstance> {
  const fastify = Fastify(serverOptions);

  const moduleNameToId: InstancesMap = new Map();
  const providerNameToId: InstancesMap = new Map();

  const allProviders = new Set<ProviderAny>();
  walkModules(root, (m) => {
    ensureModuleNameUnicity(moduleNameToId, m);
    Object.values(m.deps).forEach((p) => {
      walkProviders(p as ProviderAny, (pp) => {
        ensureProviderNameUnicity(providerNameToId, pp as ProviderAny);
        allProviders.add(pp as ProviderAny);
      });
    });
  });

  const container = new Container();

  await registerModule(fastify, root, container);

  fastify.addHook("onReady", async () => {
    for (const prov of allProviders) {
      if (!prov.onReady) {
        continue;
      }

      const deps = await resolveDeps(container, prov);
      const value = await container.get(prov);
      await prov.onReady({ fastify, deps: deps, value: value });
    }
  });

  fastify.addHook("onClose", async () => {
    for (const prov of allProviders) {
      if (!prov.onClose) {
        continue;
      }

      const deps = await resolveDeps(container, prov);
      const value = await container.get(prov);
      await prov.onClose({ fastify, deps: deps, value: value });
    }
  });

  fastify.decorate("describeTree", () => describeTree(root));

  await fastify.ready();

  return fastify;
}

function walkModules(m: ModuleAny, visit: (m: ModuleAny) => void): void {
  visit(m);
  for (const s of m.subModules) {
    walkModules(s, visit);
  }
}

function walkProviders(p: ProviderAny, visit: (p: ProviderAny) => void): void {
  visit(p);
  for (const dep of Object.values(p.deps)) {
    walkProviders(dep as ProviderAny, visit);
  }
}

function ensureModuleNameUnicity(map: InstancesMap, mod: ModuleAny): void {
  const id = getModuleId(mod);
  const existing = map.get(mod.name);
  if (!existing) {
    map.set(mod.name, id);
    return;
  }
  if (existing !== id) {
    throw new Error(
      `Duplicate module name "${mod.name}" bound to different instances: ${existing} vs ${id}.`,
    );
  }
}

function ensureProviderNameUnicity(map: InstancesMap, p: ProviderAny): void {
  const id = getProviderId(p);
  const existing = map.get(p.name);
  if (!existing) {
    map.set(p.name, id);
    return;
  }

  if (existing !== id) {
    throw new Error(
      `Duplicate provider name "${p.name}" bound to different instances: ${existing} vs ${id}.`,
    );
  }
}
