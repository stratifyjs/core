import { expectError, expectType } from "tsd";
import type { FastifyInstance } from "fastify";
import { createAdapter } from "./adapters";
import { createInstaller } from "./installers";

declare module "fastify" {
  interface FastifyInstance {
    externalPluginClient: {
      query(): string;
    };
  }
}

createAdapter({
  expose: ({ fastify }) => {
    expectType<string>(fastify.version);
    expectType<string>(fastify.externalPluginClient.query());
    expectType<boolean>(fastify.hasDecorator("externalPluginClient"));
    expectType<{ query(): string }>(
      fastify.getDecorator<{ query(): string }>("externalPluginClient"),
    );

    expectError(fastify.server);
    expectError(fastify.register);
    expectError(fastify.route);
    expectError(fastify.addHook);
    expectError(fastify.decorate);
    expectError(fastify.setErrorHandler);
    expectError(fastify.addContentTypeParser);
    expectError(fastify.listen);
    expectError(fastify.close);
    expectError(fastify.inject);
    expectError(fastify.withTypeProvider);
    expectError((fastify.version = "changed"));

    return fastify.externalPluginClient;
  },
});

createInstaller({
  install: async ({ fastify }) => {
    expectType<FastifyInstance>(fastify);

    fastify.register(async () => {});
    fastify.setErrorHandler(async (_error, _request, reply) => {
      await reply.send({ handled: true });
    });
  },
});
