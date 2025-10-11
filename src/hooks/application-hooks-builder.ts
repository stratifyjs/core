import { FastifyInstance } from "fastify";
import { AppHookMap, AppHookName } from "./hooks.types";
import {
  ensureAsyncCallback,
  ensureAsyncCallbacks,
} from "../utils/ensure-async-callback";

export class AppHooksBuilder {
  private readonly hooks: AppHookMap = {
    onReady: [],
    onClose: [],
    onListen: [],
    onRoute: [],
    onRegister: [],
    preClose: [],
  };

  constructor(private readonly moduleName: string) {}

  addHook<T extends AppHookName>(
    name: T,
    handler: AppHookMap[T][number],
  ): this {
    ensureAsyncCallback(
      `App hook "${name}" in module "${this.moduleName}"`,
      handler,
    );

    this.hooks[name].push(handler as never);
    return this;
  }

  addHooks<T extends AppHookName>(name: T, handlers: AppHookMap[T]): this {
    ensureAsyncCallbacks(
      `App hook "${name}" in module "${this.moduleName}"`,
      handlers,
    );

    for (const handler of handlers) {
      this.hooks[name].push(handler as never);
    }
    return this;
  }

  register(instance: FastifyInstance): void {
    for (const [name, handlers] of Object.entries(this.hooks)) {
      for (const handler of handlers) {
        instance.addHook(name as AppHookName, handler);
      }
    }
  }

  getHooks(): Readonly<AppHookMap> {
    return this.hooks;
  }
}
