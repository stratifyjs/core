import type { FastifyInstance } from "fastify";

const forbiddenAdapterFastifyProperties = [
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
] as const;

type ForbiddenAdapterFastifyProperty =
  (typeof forbiddenAdapterFastifyProperties)[number];

/**
 * Read-only Fastify view available to adapters.
 *
 * It retains Fastify information, inspection helpers, and declaration-merged
 * decorators while excluding APIs that configure or control the application.
 * Use an installer whenever unrestricted Fastify access is required.
 */
export type AdapterFastifyInstance = Readonly<
  Omit<FastifyInstance, ForbiddenAdapterFastifyProperty>
>;

const forbiddenProperties = new Set<PropertyKey>(
  forbiddenAdapterFastifyProperties,
);

export function restrictFastifyForAdapter(
  fastify: FastifyInstance,
): AdapterFastifyInstance {
  const functions = new Map<CallableFunction, CallableFunction>();

  const readProperty = (property: PropertyKey): unknown => {
    ensureAdapterAccessAllowed(property);

    const value = Reflect.get(fastify, property, fastify) as unknown;
    if (typeof value !== "function") return value;

    const callable = value;
    let bound = functions.get(callable);
    if (!bound) {
      bound = callable.bind(fastify) as CallableFunction;
      functions.set(callable, bound);
    }
    return bound;
  };

  const facade = Object.create(null)
  return new Proxy(facade, {
    get(_target, property) {
      return readProperty(property);
    },
    set() {
      throw readOnlyAdapterError();
    },
    defineProperty() {
      throw readOnlyAdapterError();
    },
    deleteProperty() {
      throw readOnlyAdapterError();
    },
    setPrototypeOf() {
      throw readOnlyAdapterError();
    },
    preventExtensions() {
      throw readOnlyAdapterError();
    },
  }) as AdapterFastifyInstance;
}

function ensureAdapterAccessAllowed(property: PropertyKey): void {
  if (!forbiddenProperties.has(property)) return;

  throw new TypeError(
    `Fastify API "${formatProperty(property)}" is not available in adapters. ` +
      `Use an installer to configure or control the Fastify instance.`,
  );
}

function readOnlyAdapterError(): TypeError {
  return new TypeError(
    "The Fastify instance is read-only in adapters. " +
      "Use an installer to configure or control the Fastify instance.",
  );
}

function formatProperty(property: PropertyKey): string {
  return String(property);
}
