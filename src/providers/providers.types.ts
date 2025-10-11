import { FastifyInstance } from "fastify";

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
  ProviderDepsMap extends BaseProviderDepsMap,
  Value,
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

export interface ProviderOptions<
  ProviderDepsMap extends BaseProviderDepsMap,
  Value,
> {
  name: string;
  lifecycle?: ProviderLifecycle;
  deps?: ProviderDepsMap;
  expose: (deps: DepValues<ProviderDepsMap>) => Value | Promise<Value>;
  onReady?: ProviderHook<ProviderDepsMap, Value>;
  onClose?: ProviderHook<ProviderDepsMap, Value>;
  onError?: ProviderErrorHook<ProviderDepsMap, Value>;
}
// --- Helpers to create type abstractions from concret providers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProviderContract<Value> = ProviderDef<any, Value>;

export type InferProviderContract<P> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  P extends ProviderDef<any, infer Value> ? ProviderContract<Value> : never;

export type ProvidersMap = Record<string, ProviderAny>;

export type ExposeDeps<Providers extends ProvidersMap> = {
  [K in keyof Providers]: Awaited<ReturnType<Providers[K]["expose"]>>;
};
