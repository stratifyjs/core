import { describe, test, TestContext } from "node:test";
import { createProvider } from "./providers";
import { createModule } from "../modules";
import { createApp, createInstaller } from "..";

describe("createProvider", () => {
  test("providers can inherit other providers", async (t: TestContext) => {
    t.plan(4);

    const foo = createProvider({
      name: "foo",
      expose: async () => ({ msg: "hello" }),
    });

    const fooChild = createProvider({
      name: "fooChild",
      expose: async () => ({ msg: "hello 2" }),
    });

    const bar = createProvider({
      name: "bar",
      deps: { foo, fooChild },
      expose: async ({ foo, fooChild }) => {
        t.assert.deepStrictEqual(foo, { msg: "hello" });
        t.assert.deepStrictEqual(fooChild, { msg: "hello 2" });
        return { msg: foo.msg + " world!" };
      },
    });

    const installer = createInstaller({
      deps: { bar },
      install: async ({ fastify, deps }) => {
        t.assert.ok(fastify.log);
        t.assert.deepStrictEqual(deps, { bar: { msg: "hello world!" } });
      },
    });

    const root = createModule({
      name: "root",
      installers: [installer],
    });

    const app = await createApp({ root });
    await app.close();
  });

  test("providers can be inherited by modules", async (t: TestContext) => {
    t.plan(2);

    const foo = createProvider({
      name: "foo",
      expose: async () => ({ x: 1 }),
    });

    const fooChild = createProvider({
      name: "fooChild",
      expose: async () => ({ x: 2 }),
    });

    const installer = createInstaller({
      deps: { foo, fooChild },
      install: async ({ fastify, deps }) => {
        t.assert.ok(fastify.log.error);
        t.assert.deepStrictEqual(deps, {
          foo: { x: 1 },
          fooChild: { x: 2 },
        });
      },
    });

    const root = createModule({
      name: "root",
      installers: [installer],
    });

    const app = await createApp({ root });
    await app.close();
  });

  test("providers can leverage Fastify application hooks", async (t: TestContext) => {
    t.plan(12);

    let fooReady = 0;
    let fooClosed = 0;

    const foo = createProvider({
      name: "foo",
      expose: async () => ({ x: 1 }),
      onReady: async ({ fastify, value }) => {
        fooReady++;
        t.assert.ok(fastify.log);
        t.assert.deepStrictEqual(value, { x: 1 });
      },
      onClose: async ({ fastify, value }) => {
        fooClosed++;
        t.assert.ok(fastify.log);
        t.assert.deepStrictEqual(value, { x: 1 });
      },
    });

    const fooChild = createProvider({
      name: "fooChild",
      deps: { foo },
      expose: async () => ({ x: 1 }),
      onReady: async ({ deps }) => {
        fooReady++;
        t.assert.deepStrictEqual(deps, { foo: { x: 1 } });
      },
      onClose: async ({ deps }) => {
        fooClosed++;
        t.assert.deepStrictEqual(deps, { foo: { x: 1 } });
      },
    });

    const installer = createInstaller({
      deps: { fooChild },
      install: async () => {},
    });

    const root = createModule({
      name: "root",
      installers: [installer],
    });

    t.assert.equal(fooReady, 0);
    t.assert.equal(fooClosed, 0);

    const app = await createApp({ root });
    t.assert.equal(fooReady, 2);
    t.assert.equal(fooClosed, 0);

    await app.close();
    t.assert.equal(fooReady, 2);
    t.assert.equal(fooClosed, 2);
  });

  test("singleton providers", async (t: TestContext) => {
    t.plan(1);

    let exposeCalls = 0;

    const foo = createProvider({
      name: "foo",
      expose: async () => {
        exposeCalls++;
      },
    });

    const bar = createProvider({
      name: "bar",
      deps: { foo },
      expose: async () => {},
    });

    const baz = createProvider({
      name: "baz",
      deps: { foo },
      expose: async () => {},
    });

    const installer = createInstaller({
      deps: { baz, bar },
      install: async () => {},
    });

    const root = createModule({
      name: "root",
      installers: [installer],
    });

    const app = await createApp({ root });
    t.assert.strictEqual(exposeCalls, 1);
    await app.close();
  });

  test("Alias name providers should not be allowed", async (t: TestContext) => {
    t.plan(1);

    const foo = createProvider({ name: "foo", expose: () => ({}) });
    const fooAlias = createProvider({ name: "foo", expose: () => ({}) });

    const bar = createProvider({
      name: "bar",
      deps: { foo, fooAlias },
      expose: () => ({}),
    });

    const installer = createInstaller({
      deps: { bar },
      install: async () => {},
    });

    const root = createModule({
      name: "root",
      installers: [installer],
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Duplicate provider name "foo" bound to different instances: p\d+ vs p\d+\./,
    );
  });

  test("provider.withProviders replaces deps with same type", async (t: TestContext) => {
    t.plan(1);

    const db = createProvider({
      name: "db",
      expose: async () => ({ url: "real" }),
    });

    const repo = createProvider({
      name: "repo",
      deps: { db },
      expose: async ({ db }) => db.url,
    });

    const fakeDb = createProvider({
      name: "db",
      expose: async () => ({ url: "fake" }),
    });

    const repoDouble = repo.withProviders((deps) => ({
      ...deps,
      db: fakeDb,
    }));

    const installer = createInstaller({
      deps: { repoDouble },
      install: async ({ deps }) => {
        t.assert.strictEqual(deps.repoDouble, "fake");
      },
    });

    const root = createModule({
      name: "root",
      installers: [installer],
    });

    const app = await createApp({ root });
    await app.close();
  });
});
