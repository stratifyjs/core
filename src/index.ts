import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

export * from "./providers";
export * from "./modules";
export * from "./hooks";
export * from "./controllers";
export * from "./fastify";

import { getProviderId, resolveDeps, type ProviderAny } from "./providers";
import { Container } from "./container/container";
import { describeTree } from "./printer/describe-tree";
import { getModuleId, ModuleAny, registerModule } from "./modules";

export interface CreateAppOptions {
  fastifyInstance?: FastifyInstance;
  root: ModuleAny;
  serverOptions?: FastifyServerOptions;
}

declare module "fastify" {
  export interface FastifyInstance {
    describeTree: () => string;
  }
}

type InstancesMap = Map<string, string>;

export async function createApp({
  fastifyInstance,
  serverOptions,
  root,
}: CreateAppOptions): Promise<FastifyInstance> {
  if (fastifyInstance && serverOptions) {
    throw new Error(
      "Either provide fastifyInstance or serverOptions, not both.",
    );
  }
  const fastify = fastifyInstance ?? Fastify(serverOptions);

  const moduleNameToId: InstancesMap = new Map();
  const providerNameToId: InstancesMap = new Map();

  const allProviders = new Set<ProviderAny>();
  walkModules(root, (m) => {
    ensureModuleNameUnicity(moduleNameToId, m);
    for (const hook of m.hooks) {
      collectProvidersFromConfig(hook, allProviders, providerNameToId);
    }

    for (const controller of m.controllers) {
      collectProvidersFromConfig(controller, allProviders, providerNameToId);
    }

    for (const installer of m.installers) {
      collectProvidersFromConfig(installer, allProviders, providerNameToId);
    }
  });

  const container = new Container();

  await registerModule(fastify, root, container);

  const ctx = {
    name: root.name,
    bindings: root.bindings,
  };
  fastify.addHook("onReady", async () => {
    for (const prov of allProviders) {
      if (!prov.onReady) {
        continue;
      }

      const deps = await resolveDeps(container, prov, ctx);
      const value = await container.get(prov, ctx);
      await prov.onReady({ fastify, deps: deps, value: value });
    }
  });

  fastify.addHook("onClose", async () => {
    for (const prov of allProviders) {
      if (!prov.onClose) {
        continue;
      }

      const deps = await resolveDeps(container, prov, ctx);
      const value = await container.get(prov, ctx);
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

function collectProvidersFromConfig(
  config: {
    deps: Record<string, unknown>;
  },
  allProviders: Set<ProviderAny>,
  providerNameToId: InstancesMap,
): void {
  const deps = config.deps;
  for (const p of Object.values(deps)) {
    walkProviders(p as ProviderAny, (pp) => {
      ensureProviderNameUnicity(providerNameToId, pp);
      allProviders.add(pp);
    });
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
