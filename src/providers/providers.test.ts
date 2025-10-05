import { describe, test, TestContext } from "node:test";
import { createProvider } from "./providers";
import { createModule } from "../modules/module";
import { createApp } from "..";

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

        return {
          msg: foo.msg + " world!",
        };
      },
    });

    const root = createModule({
      name: "root",
      deps: {
        bar,
      },
      accessFastify({ fastify, deps }) {
        t.assert.ok(fastify.log);
        t.assert.deepStrictEqual(deps, {
          bar: { msg: "hello world!" },
        });
      },
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

    const root = createModule({
      name: "root",
      deps: {
        foo,
        fooChild,
      },
      accessFastify({ fastify, deps }) {
        t.assert.ok(fastify.log.error);
        t.assert.deepStrictEqual(deps, {
          foo: { x: 1 },
          fooChild: { x: 2 },
        });
      },
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
      deps: {
        foo,
      },
      expose: async () => ({ x: 1 }),
      onReady: async ({ deps }) => {
        fooReady++;
        t.assert.deepStrictEqual(deps, {
          foo: { x: 1 },
        });
      },
      onClose: async ({ deps }) => {
        fooClosed++;
        t.assert.deepStrictEqual(deps, {
          foo: { x: 1 },
        });
      },
    });

    const root = createModule({
      name: "root",
      deps: {
        fooChild,
      },
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

  test("transient providers", async (t: TestContext) => {
    t.plan(1);

    let exposeCalls = 0;

    const foo = createProvider({
      name: "foo",
      lifecycle: "transient",
      expose: async () => {
        exposeCalls++;
      },
    });

    const bar = createProvider({
      name: "bar",
      deps: { foo },
      lifecycle: "transient",
      expose: async () => {},
    });

    const baz = createProvider({
      name: "baz",
      deps: { foo },
      expose: async () => {},
    });

    const root = createModule({
      name: "root",
      deps: { bar, baz },
    });

    const app = await createApp({ root });

    t.assert.strictEqual(exposeCalls, 2);

    await app.close();
  });

  test("nested transient providers", async (t: TestContext) => {
    t.plan(2);

    let nestedTransientExposeCalls = 0;
    let transientExposeCalls = 0;

    const nestedTransient = createProvider({
      name: "nestedTransient",
      lifecycle: "transient",
      expose: async () => {
        nestedTransientExposeCalls++;
      },
    });

    const transient = createProvider({
      name: "transient",
      deps: { nestedTransient },
      lifecycle: "transient",
      expose: async () => {
        transientExposeCalls++;
      },
    });

    const baz = createProvider({
      name: "baz",
      deps: { transient },
      expose: async () => {},
    });

    const taz = createProvider({
      name: "taz",
      deps: { transient },
      expose: async () => {},
    });

    const root = createModule({
      name: "root",
      deps: { baz, taz },
    });

    const app = await createApp({ root });

    t.assert.strictEqual(nestedTransientExposeCalls, 2);
    t.assert.strictEqual(transientExposeCalls, 2);

    await app.close();
  });

  test("transient provider can expose a manual onClose method for cleanup", async (t: TestContext) => {
    t.plan(1);

    let closed = false;
    const db = createProvider({
      name: "db",
      lifecycle: "transient",
      expose: async () => ({
        onClose: async () => {
          closed = true;
        },
      }),
    });

    const dbModule = createModule({
      name: "dbModule",
      deps: { db },
      accessFastify({ fastify, deps }) {
        fastify.addHook("onClose", async () => {
          await deps.db.onClose();
        });
      },
    });

    const app = await createApp({ root: dbModule });

    await app.close();

    t.assert.ok(closed);
  });

  test("singleton providers", async (t: TestContext) => {
    t.plan(1);

    let exposeCalls = 0;

    const foo = createProvider({
      name: "foo",
      lifecycle: "singleton",
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

    const root = createModule({
      name: "root",
      deps: { bar, baz },
    });

    const app = await createApp({ root });

    t.assert.strictEqual(exposeCalls, 1);

    await app.close();
  });

  test("nested transient in singleton provider", async (t: TestContext) => {
    t.plan(2);

    let nestedTransientExposeCalls = 0;
    let singletonExposeCalls = 0;

    const nestedTransient = createProvider({
      name: "nestedTransient",
      lifecycle: "transient",
      expose: async () => {
        nestedTransientExposeCalls++;
      },
    });

    const singleton = createProvider({
      name: "singleton",
      deps: { nestedTransient },
      lifecycle: "singleton",
      expose: async () => {
        singletonExposeCalls++;
      },
    });

    const baz = createProvider({
      name: "baz",
      deps: { singleton },
      expose: async () => {},
    });

    const taz = createProvider({
      name: "taz",
      deps: { singleton },
      expose: async () => {},
    });

    const root = createModule({
      name: "root",
      deps: { baz, taz },
    });

    const app = await createApp({ root });

    t.assert.strictEqual(nestedTransientExposeCalls, 1);
    t.assert.strictEqual(singletonExposeCalls, 1);

    await app.close();
  });

  test("nested singleton in transient provider", async (t: TestContext) => {
    t.plan(2);

    let nestedSingletonExposeCalls = 0;
    let transientExposeCalls = 0;

    const nestedSingleton = createProvider({
      name: "nestedSingleton",
      lifecycle: "singleton",
      expose: async () => {
        nestedSingletonExposeCalls++;
      },
    });

    const transient = createProvider({
      name: "transient",
      deps: { nestedSingleton },
      lifecycle: "transient",
      expose: async () => {
        transientExposeCalls++;
      },
    });

    const baz = createProvider({
      name: "baz",
      deps: { transient },
      expose: async () => {},
    });

    const taz = createProvider({
      name: "taz",
      deps: { transient },
      expose: async () => {},
    });

    const root = createModule({
      name: "root",
      deps: { baz, taz },
    });

    const app = await createApp({ root });

    t.assert.strictEqual(nestedSingletonExposeCalls, 1);
    t.assert.strictEqual(transientExposeCalls, 2);

    await app.close();
  });

  test("Alias name providers should not be allowed", async (t: TestContext) => {
    t.plan(1);

    const foo = createProvider({
      name: "foo",
      expose: () => {
        return {};
      },
    });

    const fooAlias = createProvider({
      name: "foo",
      expose: () => {
        return {};
      },
    });

    const bar = createProvider({
      name: "bar",
      deps: {
        foo,
        fooAlias,
      },
      expose: () => {
        return {};
      },
    });

    const root = createModule({
      name: "root",
      deps: {
        bar,
      },
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

    // create a double with fake db
    const repoDouble = repo.withProviders((deps) => ({
      ...deps,
      db: fakeDb,
    }));

    const root = createModule({
      name: "root",
      deps: { repoDouble },
      accessFastify({ deps }) {
        t.assert.strictEqual(deps.repoDouble, "fake");
      },
    });

    const app = await createApp({ root });
    await app.close();
  });

  test("transient providers cannot declare lifecycle hooks", async (t: TestContext) => {
    t.plan(3);

    t.assert.throws(
      () =>
        createProvider({
          name: "badTransientReady",
          lifecycle: "transient",
          expose: async () => ({}),
          onReady: async () => {},
        }),
      /Provider "badTransientReady" is declared as transient but defines a "onReady" hook/i,
    );

    t.assert.throws(
      () =>
        createProvider({
          name: "badTransientClose",
          lifecycle: "transient",
          expose: async () => ({}),
          onClose: async () => {},
        }),
      /Provider "badTransientClose" is declared as transient but defines a "onClose" hook/i,
    );

    t.assert.throws(
      () =>
        createProvider({
          name: "badTransientError",
          lifecycle: "transient",
          expose: async () => ({}),
          // once onError is supported in ProviderDef:
          onError: async () => {},
        }),
      /Provider "badTransientError" is declared as transient but defines a "onError" hook/i,
    );
  });
});
