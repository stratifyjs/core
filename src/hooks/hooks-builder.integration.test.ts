import { describe, test, TestContext } from "node:test";
import {
  createAdapter,
  createApp,
  createInstaller,
  createModule,
  createProvider,
} from "..";
import { createHooks } from "./hooks";
import { createController } from "../controllers/controllers";

describe("HTTP hooks builder integration", () => {
  test("registers HTTP hooks defined through createHooks", async (t: TestContext) => {
    t.plan(4);

    const exposed = { find: () => "Jean" };

    const versionAdapter = createAdapter({
      expose: async ({ fastify }) => fastify.version,
    });

    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => exposed,
    });

    const httpHooks = createHooks({
      type: "http",
      deps: { userRepo },
      adaps: { versionAdapter },
      build: async ({ builder, deps, adaps }) => {
        t.assert.deepStrictEqual(deps.userRepo, exposed);
        t.assert.ok(typeof adaps.versionAdapter === "string");
        builder.addHook("onRequest", async (req, reply) => {
          reply.header("x-hook", "executed");
        });
      },
    });

    const controller = createController({
      build: ({ builder }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });
      },
    });

    const root = createModule({
      name: "root",
      hooks: [httpHooks],
      controllers: [controller],
    });

    const app = await createApp({ root });
    const res = await app.inject({ method: "GET", url: "/" });

    t.assert.strictEqual(res.headers["x-hook"], "executed");
    t.assert.deepStrictEqual(res.json(), { ok: true });

    await app.close();
  });

  test("throws if a hook handler is not async", async (t: TestContext) => {
    t.plan(1);

    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => ({ find: () => "real" }),
    });

    const badHook = createHooks({
      type: "http",
      deps: { userRepo },
      build: ({ builder }) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        builder.addHook("onRequest", () => {});
      },
    });

    const controller = createController({
      build: ({ builder }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });
      },
    });

    const root = createModule({
      name: "root-bad-hook",
      hooks: [badHook],
      controllers: [controller],
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Expected an async function for "Hook "onRequest" in module "root-bad-hook"/,
    );
  });

  test("multiple hooks of the same type all register correctly", async (t: TestContext) => {
    t.plan(1);

    const httpHooks = createHooks({
      type: "http",
      deps: {},
      build: async ({ builder }) => {
        builder.addHook("onRequest", async (req, reply) => {
          reply.header("x-one", "1");
        });
        builder.addHook("onRequest", async (req, reply) => {
          reply.header("x-two", "2");
        });
      },
    });

    const controller = createController({
      build: ({ builder }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });
      },
    });

    const root = createModule({
      name: "root-multiple",
      hooks: [httpHooks],
      controllers: [controller],
    });

    const app = await createApp({ root });
    const res = await app.inject({ method: "GET", url: "/" });

    t.assert.deepStrictEqual(
      { xOne: res.headers["x-one"], xTwo: res.headers["x-two"] },
      { xOne: "1", xTwo: "2" },
    );

    await app.close();
  });

  test("executes all HTTP lifecycle hooks with correct behavior and arguments", async (t: TestContext) => {
    t.plan(12);

    const exposed = { find: () => "Jean" };

    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => exposed,
    });

    let onRequest_hook_executed = false;
    let preParsing_hook_executed = false;
    let preValidation_hook_executed = false;
    let preHandler_hook_executed = false;
    let onSend_hook_executed = false;
    let onResponse_hook_executed = false;
    let onError_hook_executed = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const captured: Record<string, any[]> = {
      onRequest: [],
      preParsing: [],
      preValidation: [],
      preHandler: [],
      onSend: [],
      onResponse: [],
      onError: [],
    };

    const hooks = createHooks({
      type: "http",
      deps: { userRepo },
      build: async ({ builder, deps }) => {
        t.assert.deepStrictEqual(deps.userRepo, exposed);

        builder.addHook("onRequest", async (req, reply) => {
          onRequest_hook_executed = true;
          captured.onRequest.push({ url: req.url, method: req.method });
          reply.header("x-onRequest", "ok");
        });

        builder.addHook("preParsing", async (req, reply, payload) => {
          preParsing_hook_executed = true;
          captured.preParsing.push({ url: req.url, payload: !!payload });
          return payload;
        });

        builder.addHook("preValidation", async (req) => {
          preValidation_hook_executed = true;
          captured.preValidation.push({ headers: req.headers });
        });

        builder.addHook("preHandler", async (req) => {
          preHandler_hook_executed = true;
          captured.preHandler.push({ url: req.url });
        });

        builder.addHook("onSend", async (req, reply, payload) => {
          onSend_hook_executed = true;
          captured.onSend.push({ payload });
          const json = JSON.parse(payload as string);
          json.hooked = true;
          return JSON.stringify(json);
        });

        builder.addHook("onResponse", async (req, reply) => {
          onResponse_hook_executed = true;
          captured.onResponse.push({ status: reply.statusCode });
        });

        builder.addHook("onError", async (req, reply, error) => {
          onError_hook_executed = true;
          captured.onError.push({ message: (error as Error).message });
        });
      },
    });

    const controller = createController({
      build: ({ builder }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });

        builder.addRoute({
          url: "/error",
          method: "GET",
          handler: async () => {
            throw new Error("boom");
          },
        });
      },
    });

    const root = createModule({
      name: "root-http-hooks-all",
      hooks: [hooks],
      controllers: [controller],
    });

    const app = await createApp({ root });

    const res = await app.inject({ method: "GET", url: "/" });
    const json = res.json();

    t.assert.strictEqual(res.statusCode, 200);
    t.assert.strictEqual(json.ok, true);
    t.assert.strictEqual(json.hooked, true);

    t.assert.ok(onRequest_hook_executed);
    t.assert.ok(preParsing_hook_executed);
    t.assert.ok(preValidation_hook_executed);
    t.assert.ok(preHandler_hook_executed);
    t.assert.ok(onSend_hook_executed);
    t.assert.ok(onResponse_hook_executed);

    await app.inject({ method: "GET", url: "/error" });
    t.assert.ok(onError_hook_executed);

    const firstReq = captured.onRequest[0];
    t.assert.deepStrictEqual(
      { method: firstReq.method, url: firstReq.url },
      { method: "GET", url: "/" },
    );

    await app.close();
  });
});

describe("App hooks builder integration", () => {
  test("executes all app hooks during full lifecycle with correct content", async (t: TestContext) => {
    t.plan(11);

    let onRegister_hook_executed = false;
    let onRoute_hook_executed = false;
    let onReady_hook_executed = false;
    let onListen_hook_executed = false;
    let preClose_hook_executed = false;
    let onClose_hook_executed = false;

    const captured = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onRegister: [] as any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onRoute: [] as any[],
    };

    const appHooks = createHooks({
      type: "app",
      deps: {},
      build: async ({ builder }) => {
        builder.addHook("onRegister", async (instance, opts) => {
          onRegister_hook_executed = true;
          captured.onRegister.push({ instance, opts });
        });

        builder.addHook("onRoute", async (routeOptions) => {
          onRoute_hook_executed = true;
          captured.onRoute.push(routeOptions);
        });

        builder.addHook("onReady", async () => {
          onReady_hook_executed = true;
        });

        builder.addHook("onListen", async () => {
          onListen_hook_executed = true;
        });

        builder.addHook("preClose", async () => {
          preClose_hook_executed = true;
        });

        builder.addHook("onClose", async () => {
          onClose_hook_executed = true;
        });
      },
    });

    const controller = createController({
      build: ({ builder }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });
      },
    });

    const installer = createInstaller({
      install({ fastify }) {
        fastify.register(
          async (sub) => {
            sub.get("/plugin", async () => ({ plugin: true }));
          },
          { prefix: "/plugin" },
        );
      },
    });

    const root = createModule({
      name: "root-all-hooks",
      hooks: [appHooks],
      controllers: [controller],
      installers: [installer],
    });

    const app = await createApp({ root });

    await app.ready();

    t.assert.strictEqual(onRegister_hook_executed, true);
    t.assert.strictEqual(onRoute_hook_executed, true);
    t.assert.strictEqual(onReady_hook_executed, true);

    const route = captured.onRoute[0];
    t.assert.deepStrictEqual(
      { method: route.method, url: route.url },
      { method: "GET", url: "/" },
    );

    const reg = captured.onRegister[0];
    t.assert.ok(reg.instance);
    t.assert.strictEqual(typeof reg.opts, "object");

    await app.listen({ port: 0 });
    t.assert.strictEqual(onListen_hook_executed, true);

    t.assert.strictEqual(preClose_hook_executed, false);
    t.assert.strictEqual(onClose_hook_executed, false);

    await app.close();

    t.assert.strictEqual(preClose_hook_executed, true);
    t.assert.strictEqual(onClose_hook_executed, true);
  });
});
