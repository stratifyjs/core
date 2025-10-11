import {
  AdapterAny,
  AdapterDef,
  AdapterMap,
  AdapterOptions,
  AdapterValues,
} from "./adapters.types";
import type { FastifyInstance } from "fastify";

export function createAdapter<Value>(
  def: AdapterOptions<Value>,
): AdapterDef<Value> {
  const self: AdapterDef<Value> = {
    name: def.name ?? "unknown",
    expose: def.expose,
  };

  return self;
}

export async function resolveAdapterMap<AMap extends AdapterMap>(
  fastify: FastifyInstance,
  adapters: AMap,
): Promise<AdapterValues<AMap>> {
  // Memoized within a single resolution pass to support
  // circular dependencies
  const cache = new Map<AdapterAny, unknown>();

  const resolveOne = async (adapter: AdapterAny): Promise<unknown> => {
    if (cache.has(adapter)) return cache.get(adapter);

    const value = await adapter.expose({
      fastify,
    });

    cache.set(adapter, value);
    return value;
  };

  const out: Record<string, unknown> = {};
  for (const [name, adapter] of Object.entries(adapters)) {
    out[name] = await resolveOne(adapter);
  }

  return out as AdapterValues<AMap>;
}
