import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

export * from "./providers";
export * from "./modules";
export * from "./hooks";
export * from "./controllers";
export * from "./fastify";

import { getProviderId, resolveDeps } from "./providers/providers";
import type {
  BaseProviderDepsMap,
  ProviderAny,
  ProviderDef,
} from "./providers/providers.types";
import { Container } from "./container/container";
import { describeTree } from "./printer/describe-tree";
import { getModuleId, registerModule } from "./modules/module";
import type { ModuleAny, ModuleContext } from "./modules/module.types";

export interface CreateAppOptions {
  root: ModuleAny;
  fastifyInstance?: FastifyInstance;
  serverOptions?: FastifyServerOptions;
  overrides?: ProviderAny[];
}

export interface IocContainer {
  get<ProviderDepsMap extends BaseProviderDepsMap, Value>(
    provider: ProviderDef<ProviderDepsMap, Value>,
  ): Promise<Value>;
  get<Value = unknown>(providerName: string): Promise<Value>;
}

declare module "fastify" {
  export interface FastifyInstance {
    describeTree: () => string;
    ioc: IocContainer;
  }
}

type InstancesMap = Map<string, string>;

class ApplicationIocContainer implements IocContainer {
  constructor(
    private readonly container: Container,
    private readonly providersByName: Map<string, ProviderAny>,
    private readonly providerContexts: Map<ProviderAny, ModuleContext>,
  ) {}

  get<ProviderDepsMap extends BaseProviderDepsMap, Value>(
    provider: ProviderDef<ProviderDepsMap, Value>,
  ): Promise<Value>;
  get<Value = unknown>(providerName: string): Promise<Value>;
  async get(providerOrName: ProviderAny | string): Promise<unknown> {
    const provider =
      typeof providerOrName === "string"
        ? this.providersByName.get(providerOrName)
        : providerOrName;
    const providerName =
      typeof providerOrName === "string" ? providerOrName : providerOrName.name;
    const providerContext = provider
      ? this.providerContexts.get(provider)
      : undefined;

    if (!provider || !providerContext) {
      throw new Error(
        `Provider "${providerName}" is not registered in the application.`,
      );
    }

    return this.container.get(provider, providerContext);
  }
}

export async function createApp({
  fastifyInstance,
  serverOptions,
  root,
  overrides = [],
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
  const providerContexts = new Map<ProviderAny, ModuleContext>();
  walkModules(root, (m) => {
    ensureModuleNameUnicity(moduleNameToId, m);
    const moduleContext = {
      name: m.name,
      bindings: m.bindings,
    };
    for (const hook of m.hooks) {
      collectProvidersFromConfig(
        hook,
        allProviders,
        providerNameToId,
        providerContexts,
        moduleContext,
      );
    }

    for (const controller of m.controllers) {
      collectProvidersFromConfig(
        controller,
        allProviders,
        providerNameToId,
        providerContexts,
        moduleContext,
      );
    }

    for (const installer of m.installers) {
      collectProvidersFromConfig(
        installer,
        allProviders,
        providerNameToId,
        providerContexts,
        moduleContext,
      );
    }
  });
  const providersByName = new Map(
    [...allProviders].map((provider) => [provider.name, provider]),
  );

  const overrideMap = new Map<string, ProviderAny>();
  for (const p of overrides) {
    overrideMap.set(p.name, p);
  }

  const container = new Container(overrideMap);
  const ctx = {
    name: root.name,
    bindings: root.bindings,
  };

  fastify.decorate(
    "ioc",
    new ApplicationIocContainer(container, providersByName, providerContexts),
  );

  await registerModule(fastify, root, container);

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
  providerContexts: Map<ProviderAny, ModuleContext>,
  moduleContext: ModuleContext,
): void {
  const deps = config.deps;
  for (const p of Object.values(deps)) {
    walkProviders(p as ProviderAny, (pp) => {
      ensureProviderNameUnicity(providerNameToId, pp);
      allProviders.add(pp);
      if (!providerContexts.has(pp)) {
        providerContexts.set(pp, moduleContext);
      }
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
