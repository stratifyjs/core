# Stratify

Stratify is Fastify with a clear architectural model: **modules**, **controllers**, **hooks**, **installers**, **adapters**, and a first-class **Dependency Injection (DI)** system. You keep Fastify’s performance and ecosystem while gaining a predictable structure and strong TypeScript ergonomics.

## Installation

```bash
npm install @stratify/core
# or
pnpm add @stratify/core
# or
yarn add @stratify/core
```

---

## 1) Create a Module

A Stratify app is a **tree of modules**. Each module can include controllers, hooks, installers, and submodules.

```js
import { createModule } from "@stratify/core";

const root = createModule({
  name: "root", // required unique name
  encapsulate: true, // isolate Fastify scope (default: true)
  controllers: [], // HTTP controllers (routes)
  hooks: [], // application or HTTP lifecycle hooks
  installers: [], // install Fastify utilities (plugins, compilers, parsers, etc.)
  subModules: [], // nested modules (domain composition)
});
```

### Encapsulation

Each module is a Fastify plugin under the hood.

- `encapsulate: true` — runs in its own Fastify context; decorators/serializers/settings are private to the module.
- `encapsulate: false` — shares the parent context; good for shared infrastructure (for example, configuration, CORS).

---

## 2) Bootstrapping

```js
import { createApp } from "@stratify/core";

const app = await createApp({ root });
await app.listen({ port: 3000 });
```

---

## 3) Providers (DI)

Providers are DI services that expose values or APIs.
They can depend on other providers and may define lifecycle hooks if they are singletons.

```js
import { createProvider } from "@stratify/core";

// simple service
const usersRepository = createProvider({
  name: "usersRepository",
  expose: async () => ({
    get: (id) => ({ id, name: "Ada" }),
  }),
});

// composed service depending on another provider
const profiles = createProvider({
  name: "profiles",
  deps: { usersRepository },
  expose: async ({ usersRepository }) => ({
    find: async (id) => usersRepository.get(id),
  }),
  // optional hooks:
  // onReady: async ({ fastify, deps, value }) => {},
  // onClose: async ({ fastify, deps, value }) => {},
});
```

---

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
  build: async ({ builder, deps }) => {
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

---

## 5) Hooks

Hooks are either **HTTP** ( request lifecycle) or **application** (server lifecycle).
All handlers must be async.

### HTTP hooks

```js
import { createHooks } from "@stratify/core";

const httpHooks = createHooks({
  type: "http",
  name: "core-http", // optional label
  build: async ({ builder }) => {
    builder.addHook("onRequest", async (req, reply) => {
      // example: simple auth header presence check
      if (!req.headers.authorization) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });

    builder.addHook("onResponse", async (_req, reply) => {
      // add standard headers for all responses
      reply.header("x-frame-options", "DENY");
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
  build: async ({ builder }) => {
    builder.addHook("onReady", async () => {
      // server prepared; good place to warm caches, start schedulers, etc.
    });

    builder.addHook("onClose", async () => {
      // great place to close DB connections or other resources
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

---

## 6) Installers

Installers configure Fastify for a module scope.
They run **after app hooks and before controllers**.
Use them to register external plugins (for example, sessions, CORS), compilers, validators, parsers, error formatters etc.

```js
import { createInstaller, createModule } from "@stratify/core";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";

const sessionInstaller = createInstaller({
  name: "session",
  install: async ({ fastify }) => {
    // It is important to await plugin registration
    // if you plan to create adapters that depend on
    // decorators exposed by these plugins.
    // Awaiting ensures they are immediately available.
    await fastify.register(fastifyCookie);
    await fastify.register(fastifySession, {
      secret: "a secret with minimum length of 32 characters",
    });
  },
});

const root = createModule({
  name: "root",
  installers: [sessionInstaller],
});
```

---

## 7) Adapters

Adapters expose values derived from the **current Fastify instance**.
They are **resolved for each component that uses them**, ensuring the correct Fastify context and state.

Adapters are meant for reading instance-scoped data or exposing lightweight utilities.
They should **not register plugins, routes, or hooks** — that would duplicate for every consumer.
Use **installers** for such actions.

### Example: session adapter (for `@fastify/session`)

```js
import { createAdapter, createController } from "@stratify/core";

const sessionAdapter = createAdapter({
  name: "session",
  expose: async () => {
    // Instance-scoped helpers around req.session
    return {
      get(req, key) {
        return req.session.get(key);
      },
      set(req, key, value) {
        req.session.set(key, value);
      },
      destroy(req) {
        return req.session.destroy();
      }
    };
  },
});

const sessionController = createController({
  adaps: { session: sessionAdapter },
  build: async ({ builder, adaps }) => {
    builder.addRoute({
      method: "POST",
      url: "/session/login",
      handler: async (req) => {
        adaps.session.set(req, "userId", "123");
        return { ok: true };
      },
    });

    builder.addRoute({
      method: "GET",
      url: "/session/me",
      handler: async (req) => {
        const userId = adaps.session.get(req, "userId");
        return { userId: userId ?? null };
      },
    });

    builder.addRoute({
      method: "POST",
      url: "/session/logout",
      handler: async (req) => {
        await adaps.session.destroy(req);
        return { ok: true };
      },
    });
  },
});
```

Attach alongside the installer:

```js
import { createModule } from "@stratify/core";

const root = createModule({
  name: "root",
  installers: [sessionInstaller],
  controllers: [sessionController],
});
```
