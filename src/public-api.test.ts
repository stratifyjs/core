import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as api from "./index";

describe("public API", () => {
  test("only exposes supported runtime utilities", () => {
    const exports = Object.keys(api).sort();

    // Type-only exports are erased, so this list is the complete JavaScript API.
    assert.deepStrictEqual(exports, [
      "adapter",
      "contract",
      "controller",
      "createAdapter",
      "createApp",
      "createController",
      "createHooks",
      "createInstaller",
      "createModule",
      "createProvider",
      "hooks",
      "installer",
      "mod",
      "provider",
    ]);
  });

  test("exports factory shortcuts as direct aliases", () => {
    assert.strictEqual(api.provider, api.createProvider);
    assert.strictEqual(api.mod, api.createModule);
    assert.strictEqual(api.hooks, api.createHooks);
    assert.strictEqual(api.controller, api.createController);
    assert.strictEqual(api.installer, api.createInstaller);
    assert.strictEqual(api.adapter, api.createAdapter);
  });
});
