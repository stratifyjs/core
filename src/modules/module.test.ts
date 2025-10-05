import { describe, test, TestContext } from "node:test";
import { createModule } from "./module";
import { createApp, createProvider } from "..";

describe("module integration", () => {
  test("createModule defaults + describeTree presence", async (t: TestContext) => {
    t.plan(2);

    const root = createModule({
      name: "root-defaults",
      accessFastify({ fastify, deps }) {
        t.assert.ok(fastify.log);
        t.assert.deepStrictEqual(deps, {});
      },
    });

    const app = await createApp({ root });

    await app.close();
  });

  test("Alias name subModules should not be allowed", async (t: TestContext) => {
    t.plan(1);

    const foo = createModule({
      name: "foo",
    });

    const fooAlias = createModule({
      name: "foo",
    });

    const root = createModule({
      name: "root",
      subModules: [foo, fooAlias],
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Duplicate module name "foo" bound to different instances: m\d+ vs m\d+\./,
    );
  });

  test("Alias in nested subModules should not be allowed", async (t: TestContext) => {
    t.plan(1);

    const foo = createModule({
      name: "foo",
    });

    const fooAlias = createModule({
      name: "foo",
    });

    const root = createModule({
      name: "root",
      subModules: [
        foo,
        createModule({
          name: "submodule",
          subModules: [fooAlias],
        }),
      ],
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Duplicate module name "foo" bound to different instances: m\d+ vs m\d+\./,
    );
  });

  test("encapsulation=true (default) isolates decorations between sibling subModules", async (t: TestContext) => {
    t.plan(2);

    const subA = createModule({
      name: "subA",
      accessFastify: async ({ fastify }) => {
        fastify.decorate("onlyA", 123);
      },
    });

    const subB = createModule({
      name: "subB",
      accessFastify: async ({ fastify }) => {
        t.assert.throws(() => fastify.getDecorator("onlyA"), {
          code: "FST_ERR_DEC_UNDECLARED",
        });
      },
    });

    const root = createModule({
      name: "root-encapsulated",
      subModules: [subA, subB],
    });

    const app = await createApp({ root });
    t.assert.throws(() => app.getDecorator("onlyA"), {
      code: "FST_ERR_DEC_UNDECLARED",
    });

    await app.close();
  });

  test("encapsulation=true share context with subModules", async (t: TestContext) => {
    t.plan(2);

    const subA = createModule({
      name: "subA",
      accessFastify: async ({ fastify }) => {
        fastify.decorate("onlyA", 123);
      },
      subModules: [
        createModule({
          name: "child",
          accessFastify: async ({ fastify }) => {
            t.assert.strictEqual(fastify.getDecorator("onlyA"), 123);
          },
          subModules: [
            createModule({
              name: "grand-child",
              accessFastify: async ({ fastify }) => {
                t.assert.strictEqual(fastify.getDecorator("onlyA"), 123);
              },
            }),
          ],
        }),
      ],
    });

    const root = createModule({
      name: "root-encapsulated",
      subModules: [subA],
    });

    const app = await createApp({ root });

    await app.close();
  });

  test("encapsulation=false exposes decorations to siblings", async (t: TestContext) => {
    t.plan(2);

    const openA = createModule({
      name: "openA",
      encapsulate: false,
      accessFastify: async ({ fastify }) => {
        fastify.decorate("shared", true);
      },
      subModules: [
        createModule({
          name: "subOpenA",
          encapsulate: false,
          accessFastify: async ({ fastify }) => {
            fastify.decorate("subShared", true);
          },
        }),
      ],
    });

    const openB = createModule({
      name: "openB",
      accessFastify: async ({ fastify }) => {
        t.assert.strictEqual(fastify.getDecorator("shared"), true);
        t.assert.strictEqual(fastify.getDecorator("subShared"), true);
      },
    });

    const root = createModule({
      name: "root-open",
      subModules: [openA, openB],
    });

    const app = await createApp({ root });

    await app.close();
  });

  test("encapsulation=false do not propagate to parents", async (t: TestContext) => {
    t.plan(2);

    const openA = createModule({
      name: "openA",
      subModules: [
        createModule({
          name: "subOpenA",
          encapsulate: false,
          accessFastify: async ({ fastify }) => {
            fastify.decorate("subShared", true);
          },
        }),
      ],
    });

    const openB = createModule({
      name: "openB",
      accessFastify: async ({ fastify }) => {
        t.assert.throws(() => fastify.getDecorator("subShared"), {
          code: "FST_ERR_DEC_UNDECLARED",
        });
      },
    });

    const root = createModule({
      name: "root-open",
      subModules: [openA, openB],
    });

    const app = await createApp({ root });

    t.assert.throws(() => app.getDecorator("subShared"), {
      code: "FST_ERR_DEC_UNDECLARED",
    });

    await app.close();
  });

  test("encapsulation=false do not exposes encapsulated submodules decorations to siblings", async (t: TestContext) => {
    t.plan(1);

    const openA = createModule({
      name: "openA",
      encapsulate: false,
      subModules: [
        createModule({
          name: "subOpenAEncapsulated",
          encapsulate: true,
          accessFastify: async ({ fastify }) => {
            fastify.decorate("subEncapsulated", true);
          },
        }),
      ],
    });

    const openB = createModule({
      name: "openB",
      accessFastify: async ({ fastify }) => {
        t.assert.throws(() => fastify.getDecorator("subEncapsulated"), {
          code: "FST_ERR_DEC_UNDECLARED",
        });
      },
    });

    const root = createModule({
      name: "root-open",
      subModules: [openA, openB],
    });

    const app = await createApp({ root });

    await app.close();
  });

  test("module.withProviders replaces a provider with fake", async (t: TestContext) => {
    t.plan(1);

    const userRepo = createProvider({
      name: "userRepo",
      expose: async () => ({ find: () => "real" as string }),
    });

    const foundValues: string[] = [];
    const root = createModule({
      name: "root",
      deps: { userRepo },
      accessFastify({ deps }) {
        foundValues.push(deps.userRepo.find());
      },
    });

    const fakeUserRepo = createProvider({
      name: "userRepo",
      expose: async () => ({ find: () => "fake" as string }),
    });

    const rootDouble = root.withProviders((providers) => ({
      ...providers,
      userRepo: fakeUserRepo,
    }));

    const app = await createApp({
      root: root,
    });

    const doubleApp = await createApp({
      root: rootDouble,
    });

    t.assert.deepStrictEqual(foundValues, ["real", "fake"]);

    await app.close();
    await doubleApp.close();
  });
});
