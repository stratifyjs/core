import { describe, test, TestContext } from "node:test";
import {
  adapter,
  controller,
  createApp,
  hooks,
  installer,
  mod,
  provider,
} from "./index";

describe("factory aliases", () => {
  test("compose modules using shorthand helpers", async (t: TestContext) => {
    const users = provider({
      name: "alias-users",
      expose: async () => ({
        find: () => "Jean",
      }),
    });

    const versionAdapter = adapter({
      name: "alias-version",
      expose: async ({ fastify }) => fastify.version,
    });

    const httpHooks = hooks({
      type: "http",
      deps: { users },
      adaps: { version: versionAdapter },
      build: async ({ builder, deps, adaps }) => {
        builder.addHook("onRequest", async (_req, reply) => {
          reply.header(
            "x-alias-hooks",
            `${deps.users.find()}@${adaps.version}`,
          );
        });
      },
    });

    const decorators = installer({
      deps: { users },
      install: async ({ fastify, deps }) => {
        fastify.decorate("aliasLookup", () => deps.users.find());
      },
    });

    const aliasController = controller({
      deps: { users },
      build: ({ builder, deps }) => {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async (req) => {
            const lookup = req.server.getDecorator<() => string>("aliasLookup");
            return {
              viaController: deps.users.find(),
              viaInstaller: lookup(),
            };
          },
        });
      },
    });

    const root = mod({
      name: "alias-root",
      hooks: [httpHooks],
      installers: [decorators],
      controllers: [aliasController],
    });

    const app = await createApp({ root });
    const res = await app.inject({ method: "GET", url: "/" });
    const json = res.json();

    t.assert.deepStrictEqual(json, {
      viaController: "Jean",
      viaInstaller: "Jean",
    });
    t.assert.strictEqual(res.headers["x-alias-hooks"], `Jean@${app.version}`);

    await app.close();
  });
});
