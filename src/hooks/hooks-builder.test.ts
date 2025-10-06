import { describe, test } from "node:test";
import assert from "node:assert";
import type { HttpHookName } from "./hooks.types";
import { HttpHooksBuilder } from "./hooks-builder";

const HOOKS: HttpHookName[] = [
  "onRequest",
  "preParsing",
  "preValidation",
  "preHandler",
  "preSerialization",
  "onSend",
  "onResponse",
  "onTimeout",
  "onError",
  "onRequestAbort",
];

describe("HttpHooksBuilder", () => {
  const asyncFn = async () => {};
  const syncFn = () => {};

  test("should add and retrieve hooks", () => {
    const builder = new HttpHooksBuilder("users");
    builder.addHook("onRequest", asyncFn);
    builder.addHook("onResponse", asyncFn);

    const hooks = builder.getHooks();

    assert.deepStrictEqual(hooks.onRequest, [asyncFn]);
    assert.deepStrictEqual(hooks.onResponse, [asyncFn]);
  });

  test("should be chainable", () => {
    const builder = new HttpHooksBuilder("users");
    const result = builder.addHook("onRequest", asyncFn);
    assert.strictEqual(result, builder);
  });

  test("accepts async handlers for all hook names", () => {
    const builder = new HttpHooksBuilder("mod");

    for (const hook of HOOKS) {
      assert.doesNotThrow(() => builder.addHook(hook, asyncFn));
    }
  });

  test("throws if a hook handler is not async", () => {
    const builder = new HttpHooksBuilder("mod");

    for (const hook of HOOKS) {
      assert.throws(
        () => builder.addHook(hook, syncFn as never),
        new RegExp(
          `Expected an async function for "Hook \\"${hook}\\" in module \\"mod\\""`,
        ),
      );
    }
  });

  test("getHooks returns all hooks initialized", () => {
    const builder = new HttpHooksBuilder("sample");
    const hooks = builder.getHooks();

    for (const hook of HOOKS) {
      assert.ok(Array.isArray(hooks[hook]), `${hook} should be an array`);
    }
  });
});
