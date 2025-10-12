import { describe, test, TestContext } from "node:test";
import {
  createApp,
  createModule,
  createController,
  createAdapter,
  createHooks,
} from "..";

describe("adapters integration", () => {
  test("registers installers", async (t: TestContext) => {
    t.plan(1);

    const versionAdapter = createAdapter({
      expose: async ({ fastify }) => fastify.version,
    });

    const controller = createController({
      adaps: { versionAdapter },
      build: async ({ builder, adaps }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async (req, rep) => {
            rep.send({
              ok: true,
              msg: adaps.versionAdapter,
            });
          },
        });
      },
    });

    const root = createModule({
      name: "root",
      controllers: [controller],
    });

    const app = await createApp({
      root,
      serverOptions: {
        logger: true,
      },
    });

    const res = await app.inject({ method: "GET", url: "/" });
    const json = res.json();
    t.assert.deepStrictEqual(json, {
      ok: true,
      msg: "5.6.1",
    });

    await app.close();
  });

  test("adapters are resolved per module", async (t: TestContext) => {
    t.plan(1);

    let callCount = 0;
    const siblingAdapter = createAdapter({
      name: "sibling",
      expose: async ({ fastify }) => {
        callCount++;
        return { version: fastify.version };
      },
    });

    // Module A with its hook
    const hookA = createHooks({
      type: "http",
      adaps: { siblingAdapter },
      build: async () => {},
    });

    const moduleA = createModule({
      name: "moduleA",
      hooks: [hookA],
    });

    // Module B with its own hook
    const hookB = createHooks({
      type: "http",
      adaps: { siblingAdapter },
      build: async () => {},
    });

    const moduleB = createModule({
      name: "moduleB",
      hooks: [hookB],
    });

    const root = createModule({
      name: "root",
      subModules: [moduleA, moduleB],
    });

    const app = await createApp({ root });

    // Each sibling module should resolve its own adapter independently
    t.assert.strictEqual(callCount, 2);

    await app.close();
  });

  test("adapters are resolved once per module (cached resolution)", async (t: TestContext) => {
    t.plan(1);

    let callCount = 0;
    const sharedAdapter = createAdapter({
      name: "shared",
      expose: async ({ fastify }) => {
        callCount++;
        return { version: fastify.version };
      },
    });

    const controller = createController({
      name: "cached",
      adaps: { a1: sharedAdapter, a2: sharedAdapter },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      build: async ({ builder, adaps }) => {},
    });

    const hook = createHooks({
      type: "http",
      adaps: { a3: sharedAdapter, a4: sharedAdapter },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      build: async ({ builder, adaps }) => {},
    });

    const root = createModule({
      name: "root",
      controllers: [controller],
      hooks: [hook],
    });

    const app = await createApp({ root });

    t.assert.strictEqual(callCount, 1);

    await app.close();
  });
});
