import { ModuleContext } from "../modules";
import type {
  DepValues,
  ProviderAny,
  ProviderDef,
  BaseProviderDepsMap,
} from "../providers";

export class Container {
  private singletons = new WeakMap<object, Promise<unknown>>();

  async get<ProviderDepsMap extends BaseProviderDepsMap, Value>(
    prov: ProviderDef<ProviderDepsMap, Value>,
    ctx: ModuleContext,
  ): Promise<Value> {
    let provider = prov;
    if (provider.isContract) {
      const bound = ctx.bindings.find((p) => p.name === provider.name);
      if (!bound) {
        throw new Error(
          `Contract provider "${prov.name}" has no binding in module "${ctx.name}".`,
        );
      }

      provider = bound;
    }
    let value = this.singletons.get(provider) as Promise<Value> | undefined;
    if (!value) {
      value = this.instantiate(provider, ctx);
      this.singletons.set(provider, value);
    }

    return value;
  }

  private async instantiate<ProviderDepsMap extends BaseProviderDepsMap, Value>(
    provider: ProviderDef<ProviderDepsMap, Value>,
    ctx: ModuleContext,
  ): Promise<Value> {
    const depsEntries = Object.entries(provider.deps) as [
      string,
      ProviderAny,
    ][];

    const depsObj: Record<string, unknown> = {};
    for (const [k, p] of depsEntries) {
      depsObj[k] = await this.get(p, ctx);
    }

    return provider.expose(depsObj as DepValues<ProviderDepsMap>);
  }
}
