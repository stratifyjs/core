import test, { describe, TestContext } from "node:test";
import { createProvider } from "../providers";
import { createModule } from "../modules";
import { createAdapter, createApp } from "..";
import { createController } from "./controllers";

describe("routes builder integration", () => {
  test("registers route defined through the builder", async (t: TestContext) => {
    t.plan(3);

    const exposed = { find: () => "Jean" };
    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => exposed,
    });

    const versionAdapter = createAdapter({
      expose: async ({ fastify }) => fastify.version,
    });

    const controller = createController({
      deps: { userRepo },
      adaps: { versionAdapter },
      build({ builder, deps, adaps }) {
        t.assert.deepEqual(deps.userRepo, exposed);
        t.assert.ok(typeof adaps.versionAdapter === "string");

        builder.addRoute({
          url: "/",
          method: "GET",
          handler: async () => ({
            user: deps.userRepo.find(),
          }),
        });
      },
    });

    const root = createModule({
      name: "root",
      controllers: [controller],
    });

    const app = await createApp({ root });
    const res = await app.inject({ method: "GET", url: "/" });

    t.assert.deepStrictEqual(res.json(), { user: "Jean" });

    await app.close();
  });

  test("throws if route handler is not async", async (t: TestContext) => {
    t.plan(1);

    const controller = createController({
      build({ builder }) {
        builder.addRoute({
          url: "/bad",
          method: "GET",
          // @ts-expect-error For rare vanilla users
          handler: () => ({ user: "oops" }),
        });
      },
    });

    const root = createModule({
      name: "root-bad",
      controllers: [controller],
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Expected an async function for "\/bad handler"/,
    );
  });

  test("throws if route hook is not async", async (t: TestContext) => {
    t.plan(1);

    const controller = createController({
      build({ builder }) {
        builder.addRoute({
          url: "/bad",
          method: "GET",
          // @ts-expect-error For rare vanilla users
          onRequest: () => {},
          handler: async () => ({ user: "Jean" }),
        });
      },
    });

    const root = createModule({
      name: "root-bad",
      controllers: [controller],
    });

    await t.assert.rejects(
      () => createApp({ root }),
          /Expected an async function for "hook onRequest in module "root-bad"\[0\]"/,
    );
  });
});
