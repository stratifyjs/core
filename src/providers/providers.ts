import type { FastifyInstance } from "fastify";
import { Container } from "../container/container";
import { deepClone } from "../utils/deep-clone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BivariantCallback<T extends (...args: any) => any> = {
  bivarianceHack: T;
}["bivarianceHack"];

export type ProviderLifecycle = "singleton" | "transient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProviderAny = ProviderDef<any, any>;

export type BaseProviderDepsMap = Record<string, ProviderAny>;
export type DepValues<ProviderDepsMap extends BaseProviderDepsMap> = {
  [K in keyof ProviderDepsMap]: Awaited<
    ReturnType<ProviderDepsMap[K]["expose"]>
  >;
};

type ProviderHook<D extends BaseProviderDepsMap, V> = BivariantCallback<
  (ctx: {
    fastify: FastifyInstance;
    deps: DepValues<D>;
    value: V;
  }) => unknown | Promise<unknown>
>;

type ProviderErrorHook<D extends BaseProviderDepsMap, V> = BivariantCallback<
  (ctx: {
    fastify: FastifyInstance;
    deps: DepValues<D>;
    value: V;
    error: unknown;
  }) => unknown | Promise<unknown>
>;

export interface ProviderDef<
  ProviderDepsMap extends BaseProviderDepsMap = BaseProviderDepsMap,
  Value = unknown,
> {
  name: string;
  lifecycle: ProviderLifecycle;
  deps: ProviderDepsMap;
  onReady?: ProviderHook<ProviderDepsMap, Value>;
  onClose?: ProviderHook<ProviderDepsMap, Value>;
  onError?: ProviderErrorHook<ProviderDepsMap, Value>;
  expose: (deps: DepValues<ProviderDepsMap>) => Value | Promise<Value>;
  resolve: () => Promise<Value>;

  withProviders(
    updater: (existingDeps: ProviderDepsMap) => ProviderDepsMap,
  ): ProviderDef<ProviderDepsMap, Value>;

  _prov?: never;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProviderContract<Value> = ProviderDef<any, Value>;

export type InferProviderContract<P> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  P extends ProviderDef<any, infer Value> ? ProviderContract<Value> : never;

const kProviderId = Symbol("fastify-di:providerId");
let __seq = 0;
const nextId = () => `p${++__seq}`;

/**
 * This is not a predictible id.
 */
export function getProviderId(provider: ProviderAny): string {
  return (provider as never)[kProviderId];
}

export function createProvider<
  const ProviderDepsMap extends BaseProviderDepsMap,
  Value,
>(def: {
  name: string;
  lifecycle?: ProviderLifecycle;
  deps?: ProviderDepsMap;
  expose: (deps: DepValues<ProviderDepsMap>) => Value | Promise<Value>;
  onReady?: ProviderHook<ProviderDepsMap, Value>;
  onClose?: ProviderHook<ProviderDepsMap, Value>;
  onError?: ProviderErrorHook<ProviderDepsMap, Value>;
}): ProviderDef<ProviderDepsMap, Value> {
  if (def.lifecycle === "transient") {
    if (def.onReady) {
      throwTransientHookedError("onReady", def.name);
    }
    if (def.onClose) {
      throwTransientHookedError("onClose", def.name);
    }
    if (def.onError) {
      throwTransientHookedError("onError", def.name);
    }
  }
  const self: ProviderDef<ProviderDepsMap, Value> = {
    name: def.name,
    lifecycle: def.lifecycle ?? "singleton",
    deps: (def.deps ?? {}) as ProviderDepsMap,
    expose: def.expose,
    onReady: def.onReady,
    onClose: def.onClose,
    resolve: async () => new Container().get(self),
    withProviders(
      updater: (existingDeps: ProviderDepsMap) => ProviderDepsMap,
    ): ProviderDef<ProviderDepsMap, Value> {
      return createProvider<ProviderDepsMap, Value>({
        name: self.name,
        lifecycle: self.lifecycle,
        deps: updater(deepClone(self.deps)),
        expose: self.expose,
        onReady: self.onReady,
        onClose: self.onClose,
      });
    },
  };

  Object.defineProperty(self, kProviderId, {
    value: nextId(),
    enumerable: false,
  });

  return self;
}

export async function resolveDeps(container: Container, prov: ProviderAny) {
  const deps = prov.deps;
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(deps)) {
    out[k] = await container.get(p as ProviderAny);
  }

  return out;
}

export function throwTransientHookedError(
  hook: "onClose" | "onReady" | "onError",
  name: string,
): never {
  throw new Error(
    `Provider "${name}" is declared as transient but defines a "${hook}" hook. 
Transient providers are ephemeral value factories: they may be instantiated many times 
and do not share hooks across instances. 
Use a singleton provider if you need lifecycle management.`,
  );
}

