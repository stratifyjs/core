# Working on `@stratify/core`

## Scope

These instructions apply to this package. Run commands from `core/`.

`@stratify/core` is a TypeScript, ESM-first framework layer over Fastify 5. It
provides modules, dependency-injected providers, controllers, hooks, installers,
and adapters while preserving Fastify's plugin encapsulation model. The package
ships ESM, CommonJS, and declaration outputs from the single public entry point
`src/index.ts`.

## Source map

- `src/index.ts`: public API and `createApp`; also installs provider lifecycle
  hooks and the `fastify.describeTree()` decorator.
- `src/container/container.ts`: provider resolution, singleton caching,
  contract binding, and test/application overrides.
- `src/providers/`: providers, contracts, dependency inference, lifecycle
  definitions, and `withProviders`.
- `src/modules/`: module definitions and recursive Fastify plugin registration.
- `src/controllers/`: controller definitions, TypeBox-to-Fastify request type
  inference, and the routes builder.
- `src/hooks/`: application/HTTP hook definitions and builders.
- `src/fastify/`: Fastify adapters and installers.
- `src/printer/describe-tree.ts`: textual rendering of the module graph.
- `src/utils/`: shared runtime guards and small helpers.
- `scripts/run-tests.js`: discovers and runs every `src/**/*.test.ts` file.
- `dist/`: generated output; never edit it by hand.

Keep implementation, runtime tests, and type tests close together in `src/`.
When adding a public symbol, export it through the nearest barrel file and make
sure it is reachable from `src/index.ts`.

## Runtime model and invariants

- A module registers, in order: hooks, installers, controllers, then child
  modules. Changing this order can change decoration and hook visibility.
- Modules are Fastify plugins and default to `encapsulate: true`. Treat Fastify
  parent/child/sibling visibility as part of the public behavior.
- Module names must be unique for distinct module objects across the complete
  tree. Reusing the same module object is different from creating another module
  with the same name.
- Provider names must likewise identify one provider object across the provider
  graph reachable from hooks, installers, and controllers. Overrides deliberately
  match by provider name.
- Providers are lazy async singletons within a `Container`; the cached value is
  the promise itself, so concurrent resolution must still instantiate once.
- Contracts are placeholder providers resolved from the current module's
  `bindings`. Binding happens before name-based overrides are applied.
- Provider `onReady` and `onClose` hooks run in the root module context. A
  provider with either lifecycle hook must not depend on a contract, because a
  contract binding is module-local. `onError` exists in the types but is not
  currently invoked by `createApp`.
- Adapters expose Fastify-derived values and are cached once per adapter object,
  per module. Hooks and controllers in one module share that adapter cache. Their
  Fastify view is read-only and blocks configuration/control APIs; use an
  installer whenever unrestricted Fastify access is required.
- Route handlers and HTTP hooks must be declared with `async`; runtime guards
  reject synchronous functions to prevent callback/promise mixing. Application
  hooks go through the same guard, including Fastify hooks that may use a done
  callback.
- `createApp` accepts either `fastifyInstance` or `serverOptions`, never both,
  calls `fastify.ready()`, and returns the ready instance. Tests must close every
  created Fastify instance.
- Factory aliases (`provider`, `mod`, `controller`, `hooks`, `installer`, and
  `adapter`) are public API and should remain behaviorally identical to their
  `create*` counterparts.

Preserve generic inference through provider dependency maps, adapter maps,
controller schemas, and module tuples. Avoid widening user-provided maps or
tuples; use `const` generics and type-only imports where the surrounding code
does. The small `_prov`, `_mod`, and `_adapter` markers are intentional nominal
boundaries.

## Coding conventions

- Target Node.js/TypeScript ES2022 with ESM syntax and strict type checking.
- Use double quotes, semicolons, and trailing commas, as enforced by Prettier.
- Prefer explicit `import type` when an import has no runtime use.
- Keep public error messages descriptive and stable; tests assert exact messages
  where the diagnostic is part of the API.
- Do not add direct Fastify registrations when the existing builder or module
  registration path owns that behavior.
- Do not edit `package-lock.json` unless dependencies intentionally change. The
  repository's `.npmrc` disables local lockfile updates by default.
- Do not commit generated `dist/`, `coverage/`, or `node_modules/` content.

## Tests and validation

Runtime tests use `node:test` and are named `*.test.ts`. Integration tests should
exercise behavior through Fastify registration/injection and assert cleanup.
Compile-time API tests are named `*.test-d.ts` and use `tsd` helpers such as
`expectType` and `expectError`. Add both forms when a change affects runtime
behavior and generic inference.

Useful commands:

```sh
# One runtime test file while iterating
node --import tsx/esm --test src/path/to/file.test.ts

# All runtime and declaration tests; builds first
npm test

# Formatting and ESLint
npm run lint

# ESM, CJS, and declaration bundles
npm run build
```

Before handing off a change, run the narrowest relevant test during development,
then `npm test` and `npm run lint`. Also run `npm run build` directly when the
change affects exports or declaration generation (although `npm test` already
starts with a build). Review generated declarations when modifying complex
generic types, but keep fixes in `src/` rather than `dist/`.
