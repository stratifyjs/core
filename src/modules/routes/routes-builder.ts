import { RouteOptions } from "fastify";
import { ensureAsyncCallback, ensureAsyncCallbacks } from "../../utils/ensure-async-callback";

export class RoutesBuilder {
  private readonly routes = new Set<RouteOptions>();

  addRoute(opts: RouteOptions) {
    this.routes.add(opts);

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

    return this;
  }

  
  getRoutes(): RouteOptions[] {
    return [...this.routes];
  }
}
