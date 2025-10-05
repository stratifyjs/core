import type {
  DepValues,
  ProviderAny,
  ProviderDef,
  BaseProviderDepsMap,
} from "../providers";

export class Container {
  private singletons = new WeakMap<object, Promise<unknown>>();

  async get<ProviderDepsMap extends BaseProviderDepsMap, Value>(
    provider: ProviderDef<ProviderDepsMap, Value>,
  ): Promise<Value> {
    if (provider.lifecycle === "transient") {
      return this.instantiate(provider);
    }

    let value = this.singletons.get(provider) as Promise<Value> | undefined;
    if (!value) {
      value = this.instantiate(provider);
      this.singletons.set(provider, value);
    }

    return value;
  }

  private async instantiate<ProviderDepsMap extends BaseProviderDepsMap, Value>(
    provider: ProviderDef<ProviderDepsMap, Value>,
  ): Promise<Value> {
    const depsEntries = Object.entries(provider.deps) as [
      string,
      ProviderAny,
    ][];

    const depsObj: Record<string, unknown> = {};
    for (const [k, p] of depsEntries) {
      depsObj[k] = await this.get(p);
    }

    return provider.expose(depsObj as DepValues<ProviderDepsMap>);
  }
}
