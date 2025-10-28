import { HttpHookMap, HttpHookName } from "./hooks.types";
import { ensureAsyncCallback } from "../utils/ensure-async-callback";

export class HttpHooksBuilder {
  private readonly hooks: HttpHookMap = {
    onRequest: [],
    preParsing: [],
    preValidation: [],
    preHandler: [],
    preSerialization: [],
    onSend: [],
    onResponse: [],
    onTimeout: [],
    onError: [],
    onRequestAbort: [],
  };

  constructor(private readonly moduleName: string) {}

  addHook<T extends HttpHookName>(
    name: T,
    handler: HttpHookMap[T][number],
  ): this {
    ensureAsyncCallback(
      `Hook "${name}" in module "${this.moduleName}"`,
      handler,
    );
    this.hooks[name].push(handler as never);
    return this;
  }

  getHooks(): HttpHookMap {
    return this.hooks;
  }
}
