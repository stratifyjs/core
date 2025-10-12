import { describe, test } from "node:test";
import assert from "node:assert";
import { RoutesBuilder } from "./routes-builder";
import { StratifyRouteOptions } from "./controllers.types";

describe("RoutesBuilder", () => {
  test("should add and retrieve routes", () => {
    const builder = new RoutesBuilder("root");

    const routeA: StratifyRouteOptions = {
      method: "GET",
      url: "/a",
      handler: async () => "a",
    };

    const routeB: StratifyRouteOptions = {
      method: "POST",
      url: "/b",
      handler: async () => "b",
    };

    builder.addRoute(routeA).addRoute(routeB);

    const routes = builder.getRoutes();
    assert.deepStrictEqual(routes, [routeA, routeB]);
  });

  test("should not add duplicate route references", () => {
    const builder = new RoutesBuilder("root");

    const route: StratifyRouteOptions = {
      method: "GET",
      url: "/same",
      handler: async () => "same",
    };

    builder.addRoute(route).addRoute(route);
    const routes = builder.getRoutes();

    assert.deepStrictEqual(routes, [route]);
  });

  test("addRoute should be chainable", () => {
    const builder = new RoutesBuilder("root");

    const route: StratifyRouteOptions = {
      method: "GET",
      url: "/chain",
      handler: async () => "ok",
    };

    assert.strictEqual(builder.addRoute(route), builder);
  });

  const HOOKS = [
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

  const asyncFn = async () => {};
  const syncFn = () => {};
  const asyncArray = [asyncFn, asyncFn];
  const mixedArray = [syncFn, asyncFn];

  test("accepts async handler and async hooks (single + array)", () => {
    const builder = new RoutesBuilder("root");

    for (const hook of HOOKS) {
      const opts: StratifyRouteOptions = {
        method: "GET",
        url: `/${hook}`,
        handler: async () => "ok",
        [hook]: asyncFn,
      };

      assert.doesNotThrow(() => builder.addRoute(opts));
      assert.doesNotThrow(() =>
        builder.addRoute({
          ...opts,
          [hook]: asyncArray,
        }),
      );
      assert.doesNotThrow(() =>
        builder.addRoute({
          ...opts,
          [hook]: undefined,
        }),
      );
    }
  });

  test("throws if any hook or handler is not async", () => {
    const builder = new RoutesBuilder("root");

    for (const hook of HOOKS) {
      const url = `/${hook}-sync`;

      // Single non-async function
      const optsSingle: StratifyRouteOptions = {
        method: "GET",
        url,
        handler: async () => "ok",
        [hook]: syncFn,
      };

      assert.throws(
        () => builder.addRoute(optsSingle),
        // now matches actual format with [0] suffix
        /Expected an async function for "hook onRequest in module "root"\[\d*\]?"|hook .+ in module "root"\[\d*\]?/,
      );

      // Array containing a non-async function
      const optsArray: StratifyRouteOptions = {
        method: "GET",
        url: `${url}-array`,
        handler: async () => "ok",
        [hook]: mixedArray,
      };

      assert.throws(
        () => builder.addRoute(optsArray),
        new RegExp(
          `Expected an async function for "hook ${hook} in module "root"\\[0\\]"`,
        ),
      );
    }
  });

  test("throws if handler is not async", () => {
    const builder = new RoutesBuilder("root");

    const opts: StratifyRouteOptions = {
      method: "GET",
      url: "/bad-handler",
      // @ts-expect-error testing sync handler
      handler: () => "not async",
    };

    assert.throws(
      () => builder.addRoute(opts),
      /Expected an async function for "\/bad-handler handler"/,
    );
  });

  test("accepts async handler", () => {
    const builder = new RoutesBuilder("root");

    const opts: StratifyRouteOptions = {
      method: "GET",
      url: "/good-handler",
      handler: async () => "async",
    };

    assert.doesNotThrow(() => builder.addRoute(opts));
  });
});
