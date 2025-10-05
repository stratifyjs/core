import { describe, test } from "node:test";
import type { RouteOptions } from "fastify";
import assert from "node:assert";
import { RoutesBuilder } from "./routes-builder";

describe("RoutesBuilder", () => {
  test("should add and retrieve routes", () => {
    const builder = new RoutesBuilder();

    const routeA: RouteOptions = {
      method: "GET",
      url: "/a",
      handler: async () => "a",
    };

    const routeB: RouteOptions = {
      method: "POST",
      url: "/b",
      handler: async () => "b",
    };

    builder.addRoute(routeA).addRoute(routeB);

    const routes = builder.getRoutes();

    assert.deepStrictEqual(routes, [routeA, routeB]);
  });

  test("should not add duplicate route references", () => {
    const builder = new RoutesBuilder();

    const route: RouteOptions = {
      method: "GET",
      url: "/same",
      handler: async () => "same",
    };

    builder.addRoute(route).addRoute(route);

    const routes = builder.getRoutes();

    assert.deepStrictEqual(routes, [route]);
  });

  test("addRoute should be chainable", () => {
    const builder = new RoutesBuilder();

    const route: RouteOptions = {
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
    const builder = new RoutesBuilder();

    for (const hook of HOOKS) {
      const opts: RouteOptions = {
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
    const builder = new RoutesBuilder();

    for (const hook of HOOKS) {
      const url = `/${hook}-sync`;
      // Single non-async function
      const optsSingle: RouteOptions = {
        method: "GET",
        url,
        handler: async () => "ok",
        [hook]: syncFn,
      };

      assert.throws(
        () => builder.addRoute(optsSingle),
        new RegExp(`Expected an async function for "${url} ${hook}(\\[0\\])?"`),
      );

      // Array containing a non-async function
      const optsArray: RouteOptions = {
        method: "GET",
        url: `${url}-array`,
        handler: async () => "ok",
        [hook]: mixedArray,
      };

      assert.throws(
        () => builder.addRoute(optsArray),
        new RegExp(
          `Expected an async function for "${url}-array ${hook}\\[0\\]"`,
        ),
      );
    }
  });

  test("throws if handler is not async", () => {
    const builder = new RoutesBuilder();

    const opts: RouteOptions = {
      method: "GET",
      url: "/bad-handler",
      handler: () => "not async",
    };

    assert.throws(
      () => builder.addRoute(opts),
      `Expected an async function for "/bad-handler handler"`,
    );
  });

  test("handler is async", () => {
    const builder = new RoutesBuilder();

    const opts: RouteOptions = {
      method: "GET",
      url: "/bad-handler",
      handler: async () => "async",
    };
    builder.addRoute(opts);
  });
});
