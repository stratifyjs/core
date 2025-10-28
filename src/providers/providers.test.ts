import { describe, test, TestContext } from "node:test";
import { contract, createProvider } from "./providers";
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

  test("providers can be resolved", async (t: TestContext) => {
    t.plan(1);

    const foo = createProvider({
      name: "foo",
      deps: {
        bar: createProvider({
          name: "bar",
          expose: () => ({
            x: 1,
          }),
        }),
      },
      expose: async (deps) => ({ x: 1 + deps.bar.x }),
    });

    const prov = await foo.resolve();
    t.assert.deepStrictEqual(prov, {
      x: 2,
    });
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

describe("contract bindings", () => {
  test("throws error when contract has no binding", async (t: TestContext) => {
    const MAILER_TOKEN = "mailer";
    const Mailer = contract<{ send: (to: string, content: string) => void }>(
      MAILER_TOKEN,
    );

    const useCase = createProvider({
      name: "send-welcome",
      deps: { mailer: Mailer },
      expose: ({ mailer }) => ({
        send: (email: string) => mailer.send(email, "Welcome"),
      }),
    });

    const installer = createInstaller({
      deps: { useCase },
      install: async () => {},
    });

    const root = createModule({
      name: "root",
      installers: [installer],
      bindings: [],
    });

    await t.assert.rejects(
      () => createApp({ root }),
      /Contract provider "mailer" has no binding in module "root"/,
    );
  });

  test("resolves correctly when contract has binding", async (t: TestContext) => {
    let sent = "";
    const MAILER_TOKEN = "mailer";
    const Mailer = contract<{ send: (to: string, content: string) => void }>(
      MAILER_TOKEN,
    );

    const smtpMailer = createProvider({
      name: MAILER_TOKEN,
      expose: () => ({
        send: (email: string, content: string) => {
          sent = `${email}:${content}`;
        },
      }),
    });

    const useCase = createProvider({
      name: "welcome",
      deps: { mailer: Mailer },
      expose: ({ mailer }) => ({
        run: (email: string) => mailer.send(email, "Hi"),
      }),
    });

    const installer = createInstaller({
      deps: { useCase },
      install: async ({ deps }) => {
        deps.useCase.run("test@example.com");
      },
    });

    const root = createModule({
      name: "root",
      installers: [installer],
      bindings: [smtpMailer],
    });

    const app = await createApp({ root });
    await app.close();

    t.assert.strictEqual(sent, "test@example.com:Hi");
  });

  test("contracts usable inside controllers", async (t: TestContext) => {
    let called = false;
    const LOGGER_TOKEN = "logger";
    const Logger = contract<{ log: (msg: string) => void }>(LOGGER_TOKEN);

    const fakeLogger = createProvider({
      name: LOGGER_TOKEN,
      expose: () => ({
        log: (msg: string) => {
          if (msg === "OK") called = true;
        },
      }),
    });

    const ctrl = createProvider({
      name: "controller",
      deps: { logger: Logger },
      expose: ({ logger }) => ({
        handle: () => logger.log("OK"),
      }),
    });

    const installer = createInstaller({
      deps: { ctrl },
      install: async ({ deps }) => deps.ctrl.handle(),
    });

    const root = createModule({
      name: "root",
      installers: [installer],
      bindings: [fakeLogger],
    });

    const app = await createApp({ root });
    await app.close();

    t.assert.ok(called);
  });

  test("contract works inside hook provider", async (t: TestContext) => {
    let tracked = "";
    const TRACKER_TOKEN = "tracker";
    const Tracker = contract<{ track: (msg: string) => void }>(TRACKER_TOKEN);

    const fakeTracker = createProvider({
      name: TRACKER_TOKEN,
      expose: () => ({
        track: (msg: string) => {
          tracked = msg;
        },
      }),
    });

    const hookProv = createProvider({
      name: "hookProv",
      deps: { tracker: Tracker },
      expose: ({ tracker }) => ({
        onReady: () => tracker.track("ready"),
      }),
    });

    const installer = createInstaller({
      deps: { hookProv },
      install: async ({ deps }) => deps.hookProv.onReady(),
    });

    const root = createModule({
      name: "root",
      installers: [installer],
      bindings: [fakeTracker],
    });

    const app = await createApp({ root });
    await app.close();

    t.assert.equal(tracked, "ready");
  });

  test("contracts work as nested provider dependencies", async (t: TestContext) => {
    t.plan(1);

    let sent = "";
    const MAILER_TOKEN = "mailer";
    const Mailer = contract<{ send: (to: string, body: string) => void }>(
      MAILER_TOKEN,
    );

    const smtpMailer = createProvider({
      name: MAILER_TOKEN,
      expose: () => ({
        send: (to: string, body: string) => {
          sent = `${to}:${body}`;
        },
      }),
    });

    const notificationService = createProvider({
      name: "notification-service",
      deps: { mailer: Mailer },
      expose: ({ mailer }) => ({
        notify: (email: string) => mailer.send(email, "Notification"),
      }),
    });

    const userService = createProvider({
      name: "user-service",
      deps: { notification: notificationService },
      expose: ({ notification }) => ({
        welcome: (email: string) => notification.notify(email),
      }),
    });

    const installer = createInstaller({
      deps: { userService },
      install: async ({ deps }) =>
        deps.userService.welcome("nested@example.com"),
    });

    const root = createModule({
      name: "root",
      installers: [installer],
      bindings: [smtpMailer],
    });

    const app = await createApp({ root });
    await app.close();

    t.assert.strictEqual(sent, "nested@example.com:Notification");
  });

  test("contracts work in installer direct dependencies", async (t: TestContext) => {
    t.plan(1);

    let tracked = "";
    const TRACKER_TOKEN = "tracker";
    const Tracker = contract<{ track: (msg: string) => void }>(TRACKER_TOKEN);

    const fakeTracker = createProvider({
      name: TRACKER_TOKEN,
      expose: () => ({
        track: (msg: string) => {
          tracked = msg;
        },
      }),
    });

    const installer = createInstaller({
      deps: { tracker: Tracker },
      install: async ({ deps }) => deps.tracker.track("installer-contract-ok"),
    });

    const root = createModule({
      name: "root",
      installers: [installer],
      bindings: [fakeTracker],
    });

    const app = await createApp({ root });
    await app.close();

    t.assert.strictEqual(tracked, "installer-contract-ok");
  });
});
