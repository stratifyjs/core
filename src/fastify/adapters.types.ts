import type { FastifyInstance } from "fastify";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdapterAny = AdapterDef<any>;
export type AdapterMap = Record<string, AdapterAny>;
export type AdapterValues<M extends AdapterMap> = {
  [K in keyof M]: Awaited<ReturnType<M[K]["expose"]>>;
};

export interface AdapterOptions<
  Value = unknown,
> {
  name?: string;
  expose: (ctx: {
    fastify: FastifyInstance;
  }) => Value | Promise<Value>;
}

export interface AdapterDef<
  Value = unknown,
> {
  name: string;
  expose: (ctx: {
    fastify: FastifyInstance;
  }) => Value | Promise<Value>;
  _adapter?: never;
}
