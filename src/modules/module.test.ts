import { describe, test, TestContext } from "node:test";
import { createModule } from "./module";
import { createApp, createInstaller } from "..";

describe("module integration", () => {
  test("createModule defaults + describeTree presence", async (t: TestContext) => {
    t.plan(2);

    const installer = createInstaller({
      deps: {},
      install: async ({ fastify, deps }) => {
        t.assert.ok(fastify.log);
        t.assert.deepStrictEqual(deps, {});
      },
    });

    const root = createModule({
      name: "root-defaults",
      installers: [installer],
    });

    const app = await createApp({ root });
    await app.close();
  });

  test("Alias name subModules should not be allowed", async (t: TestContext) => {
    t.plan(1);

    const foo = createModule({ name: "foo" });
    const fooAlias = createModule({ name: "foo" });

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

    const foo = createModule({ name: "foo" });
    const fooAlias = createModule({ name: "foo" });

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

    const subAInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        fastify.decorate("onlyA", 123);
      },
    });

    const subBInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        t.assert.throws(() => fastify.getDecorator("onlyA"), {
          code: "FST_ERR_DEC_UNDECLARED",
        });
      },
    });

    const subA = createModule({
      name: "subA",
      installers: [subAInstaller],
    });

    const subB = createModule({
      name: "subB",
      installers: [subBInstaller],
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

    const subAInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        fastify.decorate("onlyA", 123);
      },
    });

    const childInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        t.assert.strictEqual(fastify.getDecorator("onlyA"), 123);
      },
    });

    const grandChildInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        t.assert.strictEqual(fastify.getDecorator("onlyA"), 123);
      },
    });

    const subA = createModule({
      name: "subA",
      installers: [subAInstaller],
      subModules: [
        createModule({
          name: "child",
          installers: [childInstaller],
          subModules: [
            createModule({
              name: "grand-child",
              installers: [grandChildInstaller],
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

    const openAInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        fastify.decorate("shared", true);
      },
    });

    const subOpenAInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        fastify.decorate("subShared", true);
      },
    });

    const openBInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        t.assert.strictEqual(fastify.getDecorator("shared"), true);
        t.assert.strictEqual(fastify.getDecorator("subShared"), true);
      },
    });

    const openA = createModule({
      name: "openA",
      encapsulate: false,
      installers: [openAInstaller],
      subModules: [
        createModule({
          name: "subOpenA",
          encapsulate: false,
          installers: [subOpenAInstaller],
        }),
      ],
    });

    const openB = createModule({
      name: "openB",
      installers: [openBInstaller],
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

    const subOpenAInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        fastify.decorate("subShared", true);
      },
    });

    const openBInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        t.assert.throws(() => fastify.getDecorator("subShared"), {
          code: "FST_ERR_DEC_UNDECLARED",
        });
      },
    });

    const openA = createModule({
      name: "openA",
      subModules: [
        createModule({
          name: "subOpenA",
          encapsulate: false,
          installers: [subOpenAInstaller],
        }),
      ],
    });

    const openB = createModule({
      name: "openB",
      installers: [openBInstaller],
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

  test("encapsulation=false do not expose encapsulated submodules decorations to siblings", async (t: TestContext) => {
    t.plan(1);

    const subOpenAEncapsulatedInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        fastify.decorate("subEncapsulated", true);
      },
    });

    const openBInstaller = createInstaller({
      deps: {},
      install: async ({ fastify }) => {
        t.assert.throws(() => fastify.getDecorator("subEncapsulated"), {
          code: "FST_ERR_DEC_UNDECLARED",
        });
      },
    });

    const openA = createModule({
      name: "openA",
      encapsulate: false,
      subModules: [
        createModule({
          name: "subOpenAEncapsulated",
          encapsulate: true,
          installers: [subOpenAEncapsulatedInstaller],
        }),
      ],
    });

    const openB = createModule({
      name: "openB",
      installers: [openBInstaller],
    });

    const root = createModule({
      name: "root-open",
      subModules: [openA, openB],
    });

    const app = await createApp({ root });
    await app.close();
  });
});
