import { Container } from "../container/container";
import { ModuleContext } from "../modules";
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

export function contract<Value>(name: string) {
  const provider = createProvider({
    name,
    expose: () => undefined as Value,
  });

  provider.isContract = true;

  return provider;
}

export function createProvider<
  const ProviderDepsMap extends BaseProviderDepsMap,
  Value,
>(
  def: ProviderOptions<ProviderDepsMap, Value>,
): ProviderDef<ProviderDepsMap, Value> {
  const self: ProviderDef<ProviderDepsMap, Value> = {
    name: def.name,
    deps: (def.deps ?? {}) as ProviderDepsMap,
    expose: def.expose,
    onReady: def.onReady,
    onClose: def.onClose,
    isContract: false,
    resolve: async () =>
      new Container().get(self, {
        name: `self-resolution:${def.name}`,
        bindings: [],
      }),
    withProviders(updater: (existingDeps: ProviderDepsMap) => ProviderDepsMap) {
      return createProvider<ProviderDepsMap, Value>({
        ...self,
        deps: updater(deepClone(self.deps)),
      });
    },
  };

  Object.defineProperty(self, kProviderId, {
    value: nextId(),
    enumerable: false,
  });

  return self;
}

export async function resolveDeps(
  container: Container,
  prov: ProviderAny,
  ctx: ModuleContext,
) {
  const deps = prov.deps;
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(deps)) {
    out[k] = await container.get(p as ProviderAny, ctx);
  }

  return out;
}
