# Stratify

**Stratify** is an architectural framework built on [**Fastify**](https://fastify.dev/) that introduces clear structural boundaries and a robust **Dependency Injection** system.
Applications are defined through **modules, providers, controllers, hooks, installers, and adapters**, while maintaining Fastify’s performance and encapsulation model.

The suffix _-ify_ acknowledges its Fastify heritage, and _strata_ expresses its guiding principle of modular layering and clear separation of concerns.

Stratify remains fully compatible with the Fastify ecosystem.

> Early stage: open to community feedback as the API matures toward stability by late 2025.

## Installation

To get started, install the CLI:

```bash
npm install -g @stratify/cli
```

Then create a new application:

```bash
npx stratify-cli new my-app
```

This generates a ready-to-use TypeScript project with ESLint, Prettier, and a modular folder structure.

If you prefer manual setup, you can install the core package directly:

```bash
npm install @stratify/core
```

## 1) Create a Module

A Stratify app is a **tree of modules**. Each module can include controllers, hooks, installers, and submodules.

```js
import { createModule } from "@stratify/core";

const root = createModule({
  name: "root", // required unique name
  encapsulate: true, // encapsulate the module (default: true)
  controllers: [], // HTTP controllers (routes)
  hooks: [], // application or HTTP lifecycle hooks
  installers: [], // install Fastify utilities (plugins, compilers, parsers, etc.)
  subModules: [], // nested modules (domain composition)
});
```

### Encapsulation

Each module is compiled into a Fastify plugin within its own [**encapsulation context**](https://fastify.dev/docs/latest/Reference/Encapsulation/). Unlike Fastify, Stratify handles dependencies through its own container, so encapsulation mainly governs hooks and adapters scope, not DI.

## 2) Bootstrapping

```js
import { createApp } from "@stratify/core";

const app = await createApp({ root });
await app.listen({ port: 3000 });
```

## 3) Providers (DI)

Providers are DI units that expose data or services.
They can depend on other providers and may define `onReady` and `onClose` hooks.

```js
import { createProvider } from "@stratify/core";

const usersRepository = createProvider({
  name: "usersRepository",
  expose: () => ({
    get: (id) => ({ id, name: "Ada" }),
  }),
});

// composed service depending on another provider
const profiles = createProvider({
  name: "profiles",
  deps: { usersRepository },
  expose: ({ usersRepository }) => ({
    find: async (id) => usersRepository.get(id),
  }),
  // optional hooks:
  // onReady: async ({ deps, value }) => {},
  // onClose: async ({ deps, value }) => {},
});
```

## 4) Controllers (Routes)

Controllers declare routes via a builder.
They can consume providers and adapters.

Stratify routes builder natively support [@sinclair/typebox](https://github.com/sinclairzx81/typebox), so request
types are automatically inferred from your schema definitions.

```js
import { createController } from "@stratify/core";
import { Type } from "@sinclair/typebox";

const userController = createController({
  // optional name (used for diagnostics)
  name: "user",
  // optional dependency maps
  deps: { profiles },
  adaps: {},
  // async build callback with routes builder
  build: ({ builder, deps }) => {
    builder.addRoute({
      method: "GET",
      url: "/users/:id",
      schema: {
        // optional TypeBox schema (fully inferred)
        params: Type.Object({ id: Type.String() }),
      },
      // Handlers must be async
      handler: async (req) => {
        const id = req.params.id; // inferred as `string`
        return deps.profiles.find(id);
      },
    });
  },
});
```

Attach to a module:

```js
const root = createModule({
  name: "root",
  controllers: [userController],
});
```

## 5) Hooks

Hooks are either **HTTP** (request lifecycle) or **application** (server lifecycle).

### HTTP hooks

```js
import { createHooks } from "@stratify/core";

const httpHooks = createHooks({
  type: "http",
  name: "core-http", // optional label
  build: ({ builder }) => {
    // All handlers must be async.
    builder.addHook("onRequest", async (req, reply) => {
      if (!req.headers.authorization) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });

    builder.addHook("onResponse", async (_req, reply) => {
      reply.header("x-content-type-options", "nosniff");
    });
  },
});
```

Read more about Fastify lifecycle hooks doc: https://fastify.dev/docs/latest/Reference/Hooks/#requestreply-hooks

### Application hooks

```js
const appHooks = createHooks({
  type: "app",
  name: "lifecycle",
  build: ({ builder }) => {
    builder.addHook("onReady", async () => {
      // some setup...
    });

    builder.addHook("onClose", async () => {
      // closing resources...
    });
  },
});
```

Attach to a module:

```js
const root = createModule({
  name: "root",
  hooks: [httpHooks, appHooks],
});
```

Read more about Fastify application hooks: https://fastify.dev/docs/latest/Reference/Hooks/#application-hooks

## 6) Installers

Installers configure Fastify for a module scope.
They run **after app hooks and before controllers**.
Use them to register external plugins (for example, sessions, CORS), compilers, validators, parsers, error handlers etc.

```js
import { createInstaller, createModule } from "@stratify/core";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";

const sessionInstaller = createInstaller({
  name: "session",
  install: async ({ fastify }) => {
    // If you need to access decorators exposed by plugins
    // during build time, e.g. to create adapters.
    // You would have to await the registration:
    // await fastify.register
    fastify.register(fastifyCookie);
    fastify.register(fastifySession, {
      secret: "a secret with minimum length of 32 characters",
    });
  },
});

const root = createModule({
  name: "root",
  installers: [sessionInstaller],
});
```

## 7) Adapters

Adapters expose values derived from the Fastify instance.

They are **resolved once for each module that uses them**, ensuring the correct encapsulation context and state. It follows that they should **NOT** register plugins, routes, or hooks; use **installers** for those actions.

### Example: version adapter

```js
import { createAdapter, createController, createModule } from "@stratify/core";

// Adapter that exposes the running Fastify version
const version = createAdapter({
  expose: ({ fastify }) => fastify.version,
});

// Controller consuming the adapter
const versionController = createController({
  adaps: { version },
  build: ({ builder, adaps }) => {
    builder.addRoute({
      method: "GET",
      url: "/version",
      handler: async () => ({ version: adaps.version }),
    });
  },
});

// Attach to a module
const root = createModule({
  name: "root",
  controllers: [versionController],
});
```

## 8) Hexagonal Architecture (Ports & Adapters)

Stratify helps to work with **Hexagonal Architecture** (also known as _Ports & Adapters_) through its
**provider contract types**.

In this architecture:

- **Ports** define the contracts of what the domain needs.
- **Adapters** implement those contracts (e.g. database, email, or external APIs).
- **Use-cases** express domain logic that depends only on ports, not on concrete implementations.

The following example demonstrates a simple email `notifications` module with tests.

### 8.1 Email Model

```ts
export interface Email {
  to: string;
  subject: string;
  body: string;
}
```

### 8.2 Mailer Port

The port defines the required interface that any mailer must implement.

```ts
import type { ProviderContract } from "@stratify/core";

interface Value {
  send(email: Email): Promise<void>;
}

export type MailerContract = ProviderContract<Value>;
```

### 8.3 Adapters

A concrete adapter implements the port contract.
Here, a `smtpMailer` simulates sending emails via SMTP or a third-party service.

```ts
import { createProvider } from "@stratify/core";
import type { MailerContract } from "../ports/mailer";

export const smtpMailer: MailerContract = createProvider({
  name: "notifications.mailer",
  expose: () => ({
    async send(email) {
      console.log(`[SMTP] -> ${email.to} | ${email.subject}`);
      // send through a real transport here...
    },
  }),
});
```

### 8.4 Use-Case and Composition

Use-cases express domain logic and are created from abstract dependencies.
A factory is defined that receives one or more provider contracts.

```ts
import { createProvider } from "@stratify/core";
import type { MailerContract } from "../ports/mailer";
import { smtpMailer } from "../adapters/smtp-mailer";

export function createSendWelcomeEmailUseCase(mailer: MailerContract) {
  return createProvider({
    name: "notifications.use-case.send-welcome-email",
    deps: { mailer },
    expose: ({ mailer }) => {
      return async (to: string) => {
        const subject = "Welcome to Stratify";
        const body = "Thanks for joining! You’re all set.";
        await mailer.send({ to, subject, body });
      };
    },
  });
}

// Singleton getter for lazy composition of the
// final dependency tree
let sendWelcomeEmailUseCase: ReturnType<
  typeof createSendWelcomeEmailUseCase
> | null = null;

export function getSendWelcomeEmailUseCase() {
  if (!sendWelcomeEmailUseCase) {
    sendWelcomeEmailUseCase = createSendWelcomeEmailUseCase(smtpMailer);
  }
  return sendWelcomeEmailUseCase;
}
```

### 8.5 Unit Test

Unit tests import only the factory logic and use a fake provider to verify behavior without external effects.
Providers can be resolved directly using their built-in `resolve()` method.

```ts
import { createProvider } from "@stratify/core";
import test from "node:test";
import type { TestContext } from "node:test";
import { createSendWelcomeEmailUseCase } from "../src/notifications/use-cases/create-send-welcome-email-use-case";
import type { MailerContract } from "../src/notifications/ports/mailer";

test("sends a welcome email via fake mailer", async (t: TestContext) => {
  const sent: Email[] = [];
  const fakeMailer: MailerContract = createProvider({
    name: "notifications.mailer",
    expose: () => ({
      async send(email) {
        sent.push(email);
      },
    }),
  });

  const useCase = createSendWelcomeEmailUseCase(fakeMailer);

  const sendWelcomeEmail = await useCase.resolve();
  await sendWelcomeEmail("ada@example.com");

  t.assert.equal(sent.length, 1);
  t.assert.equal(sent[0].to, "ada@example.com");
  t.assert.match(sent[0].subject, /welcome/i);
});
```

### 8.6 HTTP Integration

The same use-case can be injected in a controller.

```ts
import { createController } from "@stratify/core";
import { Type } from "@sinclair/typebox";
import { getSendWelcomeEmailUseCase } from "../use-cases/send-welcome-email-use-case-provider";

export const notificationsController = createController({
  name: "notifications",
  // Composition via singleton getter (lazy-loaded)
  deps: { sendWelcomeEmail: getSendWelcomeEmailUseCase() },
  build: ({ builder, deps }) => {
    builder.addRoute({
      method: "POST",
      url: "/welcome-email",
      schema: { body: Type.Object({ to: Type.String({ format: "email" }) }) },
      handler: async (req, reply) => {
        await deps.sendWelcomeEmail(req.body.to);
        return reply.code(202).send({ ok: true });
      },
    });
  },
});
```

```ts
import { createModule } from "@stratify/core";
import { notificationsController } from "./http/notifications-controller";

export const notificationsModule = createModule({
  name: "notifications",
  controllers: [notificationsController],
});
```

```ts
import { createModule, createApp } from "@stratify/core";
import { notificationsModule } from "./notifications/notifications-module";

const root = createModule({
  name: "root",
  subModules: [notificationsModule],
});

const app = await createApp({ root });
await app.listen({ port: 3000 });
```
