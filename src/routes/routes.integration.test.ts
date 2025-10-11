import test, { describe, TestContext } from "node:test";
import { createProvider } from "../providers";
import { createModule } from "../modules";
import { createApp } from "..";

describe("routes builder integration", () => {
  test("registers route defined through the builder", async (t: TestContext) => {
    t.plan(2);

    const exposed = { find: () => "Jean" };
    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => exposed,
    });

    const root = createModule({
      name: "root",
      deps: { userRepo },
      routes({ builder, deps }) {
        t.assert.deepEqual(deps.userRepo, exposed);

        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({
            user: deps.userRepo.find(),
          }),
        });
      },
    });

    const app = await createApp({ root });
    const res = await app.inject({ method: "GET", url: "/" });

    t.assert.deepStrictEqual(res.json(), { user: "Jean" });

    await app.close();
  });

  test("throws if route handler is not async", async (t: TestContext) => {
    t.plan(1);

    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => ({ find: () => "real" }),
    });

    const root = createModule({
      name: "root-bad",
      deps: { userRepo },
      routes({ builder }) {
        builder.addRoute({
          url: "/bad",
          method: "GET",
          // @ts-expect-error For rare vanilla users
          handler: () => ({ user: "oops" }),
        });
      },
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Expected an async function for "\/bad handler"/,
    );
  });

  test("throws if route hook is not async", async (t: TestContext) => {
    t.plan(1);

    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => ({ find: () => "real" }),
    });

    const root = createModule({
      name: "root-bad",
      deps: { userRepo },
      routes({ builder }) {
        builder.addRoute({
          url: "/bad",
          method: "GET",
          // @ts-expect-error For rare vanilla users
          onRequest: () => {},
          handler: async () => ({ user: "Jean" }),
        });
      },
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Expected an async function for "\/bad onRequest/,
    );
  });
});
