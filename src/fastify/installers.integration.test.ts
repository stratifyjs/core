import { describe, test, TestContext } from "node:test";
import {
  createApp,
  createInstaller,
  createModule,
  createProvider,
  createController,
} from "..";

describe("installer builder integration", () => {
  test("registers installers", async (t: TestContext) => {
    t.plan(1);

    const exposed = { greet: () => "Hello" };
    const greeter = createProvider({
      name: "greeter",
      expose: async () => exposed,
    });

    const installer = createInstaller({
      deps: { greeter },
      install: async ({ fastify, deps }) => {
        fastify.decorate("greeter", deps.greeter);
      },
    });

    const controller = createController({
      build: async ({ builder }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async (req, rep) => {
            rep.send({
              ok: true,
              msg: req.server.getDecorator<typeof exposed>("greeter").greet(),
            });
          },
        });
      },
    });

    const root = createModule({
      name: "root",
      installers: [installer],
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
      msg: "Hello",
    });

    await app.close();
  });
});
