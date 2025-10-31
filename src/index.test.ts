import { describe, test } from "node:test";
import Fastify from "fastify";
import { createApp, createModule } from "./index";
import assert from "node:assert";

describe("createApp", () => {
  test("should create a fastify instance", async () => {
    const root = createModule({ name: "root" });
    const app = await createApp({ root });
    await app.close();
  });

  test("should use fastifyInstance, if provided ", async () => {
    const fastifyInstance = Fastify();

    const root = createModule({ name: "root" });
    const app = await createApp({ fastifyInstance, root });
    await app.close();

    assert.strictEqual(app, fastifyInstance);
  });

  test("should throw if both fastifyInstance and serverOptions are provided", async () => {
    const fastifyInstance = Fastify();
    const root = createModule({ name: "root" });

    await assert.rejects(
      () => createApp({ fastifyInstance, serverOptions: {}, root }),
      {
        message: "Either provide fastifyInstance or serverOptions, not both.",
      },
    );

    await fastifyInstance.close();
  });
});
