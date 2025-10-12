import { FastifyInstance } from "fastify";
import {
  ensureAsyncCallback,
  ensureAsyncCallbacks,
} from "../utils/ensure-async-callback";
import { StratifyRouteOptions } from "./controllers.types";

export class RoutesBuilder {
  private readonly routes = new Set<
    StratifyRouteOptions<Record<string, unknown>>
  >();

  private readonly hookNames = [
    "onRequest",
    "preParsing",
    "preValidation",
    "preHandler",
    "preSerialization",
    "onSend",
    "onResponse",
    "onTimeout",
    "onError",
  ] as const;

  constructor(private readonly moduleName: string) {}

  addRoute<S extends Record<string, unknown>>(opts: StratifyRouteOptions<S>) {
    for (const name of this.hookNames) {
      ensureAsyncCallbacks(
        `hook ${name} in module "${this.moduleName}"`,
        opts[name],
      );
    }

    ensureAsyncCallback(`${opts.url} handler`, opts.handler);

    this.routes.add(opts);

    return this;
  }

  getRoutes(): StratifyRouteOptions[] {
    return [...this.routes];
  }

  register(instance: FastifyInstance) {
    for (const route of this.getRoutes()) {
      instance.route(route);
    }
  }
}
