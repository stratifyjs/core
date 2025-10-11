import { describe, test } from "node:test";
import assert from "node:assert";
import type { AppHookName } from "./hooks.types";
import { AppHooksBuilder } from "./application-hooks-builder";

const HOOKS: AppHookName[] = [
  "onReady",
  "onClose",
  "onListen",
  "onRoute",
  "onRegister",
  "preClose",
];

describe("AppHooksBuilder", () => {
  const asyncFn = async () => {};
  const asyncFn2 = async () => {};
  const syncFn = () => {};

  test("should add and retrieve hooks", () => {
    const builder = new AppHooksBuilder("users");
    builder.addHook("onReady", asyncFn);
    builder.addHook("onClose", asyncFn);

    const hooks = builder.getHooks();

    assert.deepStrictEqual(hooks.onReady, [asyncFn]);
    assert.deepStrictEqual(hooks.onClose, [asyncFn]);
  });

  test("should add multiple hooks with addHooks()", () => {
    const builder = new AppHooksBuilder("core");
    const handlers = [asyncFn, asyncFn2];

    const result = builder.addHooks("onReady", handlers);
    assert.strictEqual(result, builder, "addHooks should be chainable");

    const hooks = builder.getHooks();
    assert.deepStrictEqual(
      hooks.onReady,
      handlers,
      "addHooks should push all handlers into the array",
    );
  });

  test("should be chainable", () => {
    const builder = new AppHooksBuilder("users");
    assert.strictEqual(builder.addHook("onListen", asyncFn), builder);
    assert.strictEqual(
      builder.addHooks("onListen", [asyncFn, asyncFn2]),
      builder,
    );
  });

  test("accepts async handlers for all hook names", () => {
    const builder = new AppHooksBuilder("mod");

    for (const hook of HOOKS) {
      assert.doesNotThrow(() => builder.addHook(hook, asyncFn));
    }
  });

  test("throws if a hook handler is not async", () => {
    const builder = new AppHooksBuilder("mod");

    for (const hook of HOOKS) {
      assert.throws(
        () => builder.addHook(hook, syncFn as never),
        new RegExp(
          `Expected an async function for "App hook \\"${hook}\\" in module \\"mod\\""`,
        ),
      );
    }
  });

  test("getHooks returns all hooks initialized", () => {
    const builder = new AppHooksBuilder("sample");
    const hooks = builder.getHooks();

    for (const hook of HOOKS) {
      assert.ok(Array.isArray(hooks[hook]), `${hook} should be an array`);
    }
  });
});
