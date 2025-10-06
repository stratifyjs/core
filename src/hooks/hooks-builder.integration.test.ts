import { describe, test, TestContext } from "node:test";
import { createApp, createModule, createProvider } from "..";

describe("http hooks builder integration", () => {
  test("registers HTTP hooks defined through the builder", async (t: TestContext) => {
    t.plan(3);

    const exposed = { find: () => "Jean" };

    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => exposed,
    });

    const root = createModule({
      name: "root",
      deps: { userRepo },
      httpHooks({ builder, deps }) {
        t.assert.deepStrictEqual(deps.userRepo, exposed);

        builder.addHook("onRequest", async (req, reply) => {
          reply.header("x-hook", "executed");
        });
      },
      routes({ builder }) {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });
      },
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

    const root = createModule({
      name: "root-bad-hook",
      deps: { userRepo },
      httpHooks({ builder }) {
        // @ts-expect-error purposely non-async
        builder.addHook("onRequest", () => {});
      },
      routes({ builder }) {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });
      },
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Expected an async function for "Hook "onRequest" in module "root-bad-hook"/,
    );
  });

  test("multiple hooks of the same type all register correctly", async (t: TestContext) => {
    t.plan(1);

    const root = createModule({
      name: "root-multiple",
      httpHooks({ builder }) {
        builder.addHook("onRequest", async (req, reply) => {
          reply.header("x-one", "1");
        });

        builder.addHook("onRequest", async (req, reply) => {
          reply.header("x-two", "2");
        });
      },
      routes({ builder }) {
        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({ ok: true }),
        });
      },
    });

    const app = await createApp({ root });
    const res = await app.inject({ method: "GET", url: "/" });

    t.assert.deepStrictEqual(
      { xOne: res.headers["x-one"], xTwo: res.headers["x-two"] },
      { xOne: "1", xTwo: "2" },
    );

    await app.close();
  });
});
