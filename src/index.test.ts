import { describe, test, TestContext } from "node:test";
import Fastify from "fastify";
import {
  contract,
  createApp,
  createController,
  createModule,
  createProvider,
} from "./index";

describe("createApp", () => {
  test("should create a fastify instance", async () => {
    const root = createModule({ name: "root" });
    const app = await createApp({ root });
    await app.close();
  });

  test("should use fastifyInstance, if provided ", async (t: TestContext) => {
    const fastifyInstance = Fastify();

    const root = createModule({ name: "root" });
    const app = await createApp({ fastifyInstance, root });
    await app.close();

    t.assert.strictEqual(app, fastifyInstance);
  });

  test("should throw if both fastifyInstance and serverOptions are provided", async (t: TestContext) => {
    const fastifyInstance = Fastify();
    const root = createModule({ name: "root" });

    await t.assert.rejects(
      () => createApp({ fastifyInstance, serverOptions: {}, root }),
      {
        message: "Either provide fastifyInstance or serverOptions, not both.",
      },
    );

    await fastifyInstance.close();
  });

  describe("overriders", () => {
    test("should override a simple provider by name", async (t: TestContext) => {
      const realPayment = createProvider({
        name: "payment",
        expose: () => ({ charge: () => "real" }),
      });

      const fakePayment = createProvider({
        name: "payment",
        expose: () => ({ charge: () => "fake" }),
      });

      const paymentConsumer = createController({
        name: "payment-consumer",
        deps: { payment: realPayment },
        build: ({ builder, deps }) => {
          builder.addRoute({
            method: "GET",
            url: "/pay",
            handler: async () => deps.payment.charge(),
          });
        },
      });

      const root = createModule({
        name: "root",
        controllers: [paymentConsumer],
      });

      const app = await createApp({
        root,
        overriders: [fakePayment],
      });

      const res = await app.inject({ method: "GET", url: "/pay" });
      t.assert.strictEqual(res.statusCode, 200);
      t.assert.strictEqual(res.body, "fake");

      await app.close();
    });

    test("should override a provider that is a dependency of another provider", async (t: TestContext) => {
      const realUsers = createProvider({
        name: "usersRepository",
        expose: () => ({
          all: () => ["real-user"],
        }),
      });

      const profiles = createProvider({
        name: "profiles",
        deps: { usersRepository: realUsers },
        expose: ({ usersRepository }) => ({
          list: () => usersRepository.all().map((u: string) => `profile-${u}`),
        }),
      });

      const fakeUsers = createProvider({
        name: "usersRepository",
        expose: () => ({
          all: () => ["fake-user-1", "fake-user-2"],
        }),
      });

      const controller = createController({
        name: "profiles-controller",
        deps: { profiles },
        build: ({ builder, deps }) => {
          builder.addRoute({
            method: "GET",
            url: "/profiles",
            handler: async () => deps.profiles.list(),
          });
        },
      });

      const root = createModule({
        name: "root",
        controllers: [controller],
      });

      const app = await createApp({
        root,
        overriders: [fakeUsers],
      });

      const res = await app.inject({ method: "GET", url: "/profiles" });
      t.assert.strictEqual(res.statusCode, 200);
      t.assert.deepStrictEqual(res.json(), [
        "profile-fake-user-1",
        "profile-fake-user-2",
      ]);

      await app.close();
    });

    test("should override a contract binding", async (t: TestContext) => {
      const MAILER_TOKEN = "mailer";
      const Mailer = contract<{ send(): void }>(MAILER_TOKEN);

      const realMailer = createProvider({
        name: MAILER_TOKEN,
        expose: () => ({
          send: () => {
            throw new Error("should be overridden");
          },
        }),
      });

      let callFake = false;
      const fakeMailer = createProvider({
        name: MAILER_TOKEN,
        expose: () => ({
          send: () => {
            callFake = true;
          },
        }),
      });

      const sendWelcome = createProvider({
        name: "send-welcome",
        deps: { mailer: Mailer },
        expose: ({ mailer }) => ({
          run: () => mailer.send(),
        }),
      });

      const ctrl = createController({
        name: "welcome",
        deps: { sendWelcome },
        build: ({ builder, deps }) => {
          builder.addRoute({
            method: "POST",
            url: "/welcome",
            handler: async () => {
              deps.sendWelcome.run();
              return { ok: true };
            },
          });
        },
      });

      const notifications = createModule({
        name: "notifications",
        controllers: [ctrl],
        bindings: [realMailer],
      });

      const root = createModule({
        name: "root",
        subModules: [notifications],
      });

      const app = await createApp({
        root,
        overriders: [fakeMailer],
      });

      const res = await app.inject({
        method: "POST",
        url: "/welcome",
      });

      t.assert.strictEqual(res.statusCode, 200);
      t.assert.ok(callFake);

      await app.close();
    });

    test("should instantiate only the override, not the original", async (t: TestContext) => {
      let realCount = 0;
      let fakeCount = 0;

      const realProv = createProvider({
        name: "counter",
        expose: () => {
          realCount += 1;
          return { kind: "real" };
        },
      });

      const fakeProv = createProvider({
        name: "counter",
        expose: () => {
          fakeCount += 1;
          return { kind: "fake" };
        },
      });

      const consumerA = createProvider({
        name: "consumerA",
        deps: { counter: realProv },
        expose: ({ counter }) => counter,
      });

      const consumerB = createProvider({
        name: "consumerB",
        deps: { counter: realProv },
        expose: ({ counter }) => counter,
      });

      const root = createModule({
        name: "root",
        controllers: [
          createController({
            name: "probe",
            deps: { consumerA, consumerB },
            build: () => {},
          }),
        ],
      });

      const app = await createApp({
        root,
        overriders: [fakeProv],
      });

      t.assert.strictEqual(realCount, 0);
      t.assert.strictEqual(fakeCount, 1);

      await app.close();
    });
  });
});
