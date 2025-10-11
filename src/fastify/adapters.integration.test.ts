import { describe, test, TestContext } from "node:test";
import { createApp, createModule, createController, createAdapter } from "..";

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
});
