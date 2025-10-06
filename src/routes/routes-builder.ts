import { FastifyInstance } from "fastify";
import {
  ensureAsyncCallback,
  ensureAsyncCallbacks,
} from "../utils/ensure-async-callback";
import { StratifyRouteOptions } from "./routes.types";

export class RoutesBuilder {
  private readonly routes = new Set<
    StratifyRouteOptions<Record<string, unknown>>
  >();

  addRoute<S extends Record<string, unknown>>(opts: StratifyRouteOptions<S>) {
    ensureAsyncCallbacks(`${opts.url} onRequest`, opts.onRequest);
    ensureAsyncCallbacks(`${opts.url} preParsing`, opts.preParsing);
    ensureAsyncCallbacks(`${opts.url} preValidation`, opts.preValidation);
    ensureAsyncCallbacks(`${opts.url} preHandler`, opts.preHandler);
    ensureAsyncCallbacks(`${opts.url} preSerialization`, opts.preSerialization);
    ensureAsyncCallbacks(`${opts.url} onSend`, opts.onSend);
    ensureAsyncCallbacks(`${opts.url} onResponse`, opts.onResponse);
    ensureAsyncCallbacks(`${opts.url} onTimeout`, opts.onTimeout);
    ensureAsyncCallbacks(`${opts.url} onError`, opts.onError);

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
