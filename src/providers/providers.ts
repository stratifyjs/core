import { Container } from "../container/container";
import { deepClone } from "../utils/deep-clone";
import {
  BaseProviderDepsMap,
  ProviderAny,
  ProviderDef,
  ProviderOptions,
} from "./providers.types";

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
>(
  def: ProviderOptions<ProviderDepsMap, Value>,
): ProviderDef<ProviderDepsMap, Value> {
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
    withProviders(updater: (existingDeps: ProviderDepsMap) => ProviderDepsMap) {
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
