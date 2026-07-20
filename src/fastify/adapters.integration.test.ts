import { describe, test, TestContext } from "node:test";
import {
  createApp,
  createModule,
  createController,
  createAdapter,
  createHooks,
  createInstaller,
} from "..";

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
      msg: "5.8.5",
    });

    await app.close();
  });

  test("adapters are resolved per module", async (t: TestContext) => {
    t.plan(1);

    let callCount = 0;
    const siblingAdapter = createAdapter({
      name: "sibling",
      expose: async ({ fastify }) => {
        callCount++;
        return { version: fastify.version };
      },
    });

    // Module A with its hook
    const hookA = createHooks({
      type: "http",
      adaps: { siblingAdapter },
      build: async () => {},
    });

    const moduleA = createModule({
      name: "moduleA",
      hooks: [hookA],
    });

    // Module B with its own hook
    const hookB = createHooks({
      type: "http",
      adaps: { siblingAdapter },
      build: async () => {},
    });

    const moduleB = createModule({
      name: "moduleB",
      hooks: [hookB],
    });

    const root = createModule({
      name: "root",
      subModules: [moduleA, moduleB],
    });

    const app = await createApp({ root });

    // Each sibling module should resolve its own adapter independently
    t.assert.strictEqual(callCount, 2);

    await app.close();
  });

  test("adapters are resolved once per module (cached resolution)", async (t: TestContext) => {
    t.plan(1);

    let callCount = 0;
    const sharedAdapter = createAdapter({
      name: "shared",
      expose: async ({ fastify }) => {
        callCount++;
        return { version: fastify.version };
      },
    });

    const controller = createController({
      name: "cached",
      adaps: { a1: sharedAdapter, a2: sharedAdapter },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      build: async ({ builder, adaps }) => {},
    });

    const hook = createHooks({
      type: "http",
      adaps: { a3: sharedAdapter, a4: sharedAdapter },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      build: async ({ builder, adaps }) => {},
    });

    const root = createModule({
      name: "root",
      controllers: [controller],
      hooks: [hook],
    });

    const app = await createApp({ root });

    t.assert.strictEqual(callCount, 1);

    await app.close();
  });

  test("adapters can read instance information and installed decorators", async (t: TestContext) => {
    const externalValue = { source: "external-plugin" };

    const readExternalPlugin = createAdapter({
      expose: async ({ fastify }) => ({
        version: fastify.version,
        external: fastify.getDecorator<typeof externalValue>("externalValue"),
        stableMethodReference: fastify.getDecorator === fastify.getDecorator,
      }),
    });

    const installer = createInstaller({
      name: "external-plugin",
      deps: {},
      install: async ({ fastify }) => {
        fastify.decorate("externalValue", externalValue);
      },
    });

    const controller = createController({
      adaps: { readExternalPlugin },
      build: async ({ adaps }) => {
        t.assert.strictEqual(adaps.readExternalPlugin.version, "5.8.5");
        t.assert.strictEqual(adaps.readExternalPlugin.external, externalValue);
        t.assert.strictEqual(
          adaps.readExternalPlugin.stableMethodReference,
          true,
        );
      },
    });

    const root = createModule({
      name: "adapter-read-access",
      installers: [installer],
      controllers: [controller],
    });

    const app = await createApp({ root });
    await app.close();
  });

  test("adapters reject Fastify configuration and control APIs", async (t: TestContext) => {
    const forbidden = [
      "server",
      "withTypeProvider",
      "addSchema",
      "after",
      "close",
      "decorate",
      "decorateRequest",
      "decorateReply",
      "inject",
      "listen",
      "ready",
      "register",
      "routing",
      "route",
      "delete",
      "get",
      "head",
      "patch",
      "post",
      "put",
      "options",
      "propfind",
      "proppatch",
      "mkcalendar",
      "mkcol",
      "copy",
      "move",
      "lock",
      "unlock",
      "trace",
      "report",
      "search",
      "query",
      "all",
      "addHook",
      "setNotFoundHandler",
      "setErrorHandler",
      "setGenReqId",
      "setChildLoggerFactory",
      "setValidatorCompiler",
      "setSerializerCompiler",
      "setSchemaController",
      "setReplySerializer",
      "setSchemaErrorFormatter",
      "addContentTypeParser",
      "removeContentTypeParser",
      "removeAllContentTypeParsers",
      "addHttpMethod",
      "addConstraintStrategy",
      "supportedMethods",
      Symbol.asyncDispose,
    ];

    const forbiddenAccess = createAdapter({
      expose: async ({ fastify }) => {
        const unsafeView = fastify as unknown as Record<PropertyKey, unknown>;
        for (const property of forbidden) {
          t.assert.throws(() => unsafeView[property], {
            name: "TypeError",
            message:
              `Fastify API "${String(property)}" is not available in adapters. ` +
              "Use an installer to configure or control the Fastify instance.",
          });
          t.assert.strictEqual(property in unsafeView, false);
          t.assert.strictEqual(
            Reflect.getOwnPropertyDescriptor(unsafeView, property),
            undefined,
          );
        }

        t.assert.deepStrictEqual(Reflect.ownKeys(unsafeView), []);

        const readOnlyError = {
          name: "TypeError",
          message:
            "The Fastify instance is read-only in adapters. " +
            "Use an installer to configure or control the Fastify instance.",
        };
        t.assert.throws(
          () => Reflect.set(unsafeView, "version", "changed"),
          readOnlyError,
        );
        t.assert.throws(
          () => Reflect.defineProperty(unsafeView, "version", { value: "x" }),
          readOnlyError,
        );
        t.assert.throws(
          () => Reflect.deleteProperty(unsafeView, "version"),
          readOnlyError,
        );
        t.assert.throws(
          () => Reflect.setPrototypeOf(unsafeView, null),
          readOnlyError,
        );
        t.assert.throws(
          () => Reflect.preventExtensions(unsafeView),
          readOnlyError,
        );

        return fastify.version;
      },
    });

    const controller = createController({
      adaps: { forbiddenAccess },
      build: async ({ adaps }) => {
        t.assert.strictEqual(adaps.forbiddenAccess, "5.8.5");
      },
    });

    const root = createModule({
      name: "adapter-forbidden-access",
      controllers: [controller],
    });

    const app = await createApp({ root });
    await app.close();
  });
});
