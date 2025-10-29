# Stratify

**Stratify** is an architectural framework built on [**Fastify**](https://fastify.dev/) that introduces clear structural boundaries and a robust **Dependency Injection** system.
Applications are defined through **modules, providers, controllers, hooks, installers, and adapters**, while maintaining Fastify’s performance and encapsulation model.

The suffix _-ify_ acknowledges its Fastify heritage, and _strata_ expresses its guiding principle of modular layering and clear separation of concerns.

Stratify remains fully compatible with the Fastify ecosystem.

> Early stage: open to community feedback as the API matures toward stability by late 2025.

## Summary

- [Installation](#installation)
- [1) Create a Module](#1-create-a-module)
- [2) Bootstrapping](#2-bootstrapping)
- [3) Providers (DI)](#3-providers-di)
- [4) Controllers (Routes)](#4-controllers-routes)
- [5) Hooks](#5-hooks)
- [6) Installers](#6-installers)
- [7) Adapters](#7-adapters)
- [8) Architectures Based on the Dependency Inversion Principle (DIP)](#8-architectures-based-on-the-dependency-inversion-principle-dip)

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

### Inspecting the Application Tree

Stratify applications can describe their internal module and dependency
hierarchy through the **`describeTree()`** utility.

This function produces a human-readable text representation of the **module tree**, including
submodules, hooks, installers, controllers, adapters, and providers.

```ts
import { createApp, createModule } from "@stratify/core";

const root = createModule({
  name: "root",
  subModules: [
    createModule({ name: "child" }),
    createModule({ name: "sibling" }),
  ],
});

const app = await createApp({ root });

console.log(app.describeTree());
```

### Example output

```
🌳 mod root@m1 (encapsulate=true)
  📦 mod child@m2 (encapsulate=true)
  📦 mod sibling@m3 (encapsulate=true)
```

### Full hierarchy display

When modules include **hooks, installers, controllers, adapters, and
providers**, `describeTree()` shows each layer with dependency nesting:

```
🌳 mod root@m1 (encapsulate=true)
  📦 mod sibling@m2 (encapsulate=false)
    ⚙️ installer a
      🔧 prov siblingProv@p1
    ⚙️ installer b
    🧭 controller a
      🔌 adp siblingAdapter
      🔧 prov siblingDependent@p2
        🔧 prov siblingProv@p1
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

### `withProviders()`

All providers include a **`withProviders()`** helper.
It clones the provider and lets you replace specific dependencies, typically for unit testing.

```ts
const testProvider = profilesProvider.withProviders((deps) => ({
  ...deps,
  usersRepository: fakeUsersRepository,
}));

const profiles = await testProvider.resolve();
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

## 8) Architectures Based on the Dependency Inversion Principle (DIP)

Stratify supports architectures that rely on the **Dependency Inversion Principle (DIP)**
through its **contract providers**.

### 8.1 Declaring a Contract

Contracts are special providers that define types but cannot be instantiated:

```ts
import { contract } from "@stratify/core";

export const MAILER_TOKEN = "mailer";

export const Mailer = contract<{
  send(to: string, body: string): void;
}>(MAILER_TOKEN);
```

If a contract is used but not bound in its module, Stratify throws an error.

```ts
import { createProvider, createModule, createApp } from "@stratify/core";
import { Mailer } from "./mailer";

const sendWelcome = createProvider({
  name: "send-welcome",
  deps: { mailer: Mailer },
  expose: ({ mailer }) => ({
    run(email: string) {
      mailer.send(email, "Welcome!");
    },
  }),
});

const welcomeController = createController({
  deps: { sendWelcome },
  build: () => {}
});

const root = createModule({
  name: "root",
  controllers: [welcomeController],
  bindings: [], // No binding for "mailer"
});

await createApp({ root });
```

### 8.2 Creating a Binding

A **binding** is simply a regular provider that uses the same `name` as the contract.
It can be declared anywhere, just like any other provider.

```ts
import { createProvider } from "@stratify/core";
import { MAILER_TOKEN } from "../contracts/mailer";

export const smtpMailer = createProvider({
  name: MAILER_TOKEN,
  expose: () => ({
    send(to: string, body: string) {
      console.log(`[SMTP] ${to} -> ${body}`);
    },
  }),
});
```

### 8.3 Declaring Dependencies as Contracts

You can now declare your dependencies as **contracts**:

```ts
import { createProvider } from "@stratify/core";
import { Mailer } from "../contracts/mailer";

export const sendWelcomeEmail = createProvider({
  name: "send-welcome-email",
  deps: { mailer: Mailer },
  expose: ({ mailer }) => ({
    async execute(to: string) {
      mailer.send(to, "Welcome to Stratify!");
    },
  }),
});
```

### 8.4 Binding

Then, you must bind contracts to specific providers via the `bindings` property:

```ts
import { createController, createModule, createApp } from "@stratify/core";
import { Type } from "@sinclair/typebox";
import { sendWelcomeEmail } from "../use-cases/send-welcome-email";
import { smtpMailer } from "../adapters/smtp-mailer";

export const notificationsController = createController({
  name: "notifications",
  deps: { sendWelcomeEmail },
  build: ({ builder, deps }) => {
    builder.addRoute({
      method: "POST",
      url: "/welcome",
      schema: {
        body: Type.Object({ to: Type.String({ format: "email" }) }),
      },
      handler: async (req, reply) => {
        await deps.sendWelcomeEmail.execute(req.body.to);
        return { ok: true };
      },
    });
  },
});

const notificationsModule = createModule({
  name: "notifications",
  controllers: [notificationsController],
  bindings: [smtpMailer], // binds the "mailer" contract to smtpMailer
});

const root = createModule({
  name: "root",
  subModules: [notificationsModule],
});

const app = await createApp({ root });
await app.listen({ port: 3000 });
```
