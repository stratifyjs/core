import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteOptions,
} from "fastify";
import {
  OnErrorHookHandler,
  OnPreHandlerHandler,
  OnPreParsingHandler,
  OnPreSerializationHandler,
  OnPreValidationHandler,
  OnRequestAbortHandler,
  OnRequestHandler,
  OnResponseHandler,
  OnSendHookHandler,
  OnTimeoutHandler,
} from "../hooks";
import { Static, TSchema } from "@sinclair/typebox";
import { ExposeDeps, ProvidersMap } from "../providers";
import { RoutesBuilder } from "./routes-builder";
import { Container } from "../container/container";

type ErrorHandler = (
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) => void | Promise<void>;

// Simplify Fastify types
export type BaseStratifyRouteOptions = Omit<
  RouteOptions,
  | "onRequest"
  | "preParsing"
  | "preValidation"
  | "preHandler"
  | "preSerialization"
  | "onSend"
  | "onResponse"
  | "onTimeout"
  | "onError"
  | "handler"
  | "errorHandler"
>;

export interface StratifyRouteOptions<
  S extends Record<string, unknown> = Record<string, unknown>,
> extends BaseStratifyRouteOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  url: string;
  schema?: S;
  errorHandler?: ErrorHandler;

  handler: (
    request: FastifyRequest<ExtractRouteGenerics<S>>,
    reply: FastifyReply,
  ) => Promise<unknown>;

  // Hooks (async or sync)
  onRequest?: OnRequestHandler | OnRequestHandler[];
  preParsing?: OnPreParsingHandler | OnPreParsingHandler[];
  preValidation?: OnPreValidationHandler | OnPreValidationHandler[];
  preHandler?: OnPreHandlerHandler | OnPreHandlerHandler[];
  preSerialization?: OnPreSerializationHandler | OnPreSerializationHandler[];
  onSend?: OnSendHookHandler | OnSendHookHandler[];
  onResponse?: OnResponseHandler | OnResponseHandler[];
  onTimeout?: OnTimeoutHandler | OnTimeoutHandler[];
  onError?: OnErrorHookHandler | OnErrorHookHandler[];
  onRequestAbort?: OnRequestAbortHandler | OnRequestAbortHandler[];
}

export type ExtractRouteGenerics<S extends Record<string, unknown>> = {
  Body: S extends { body: TSchema } ? Static<S["body"]> : unknown;
  Querystring: S extends { querystring: TSchema }
    ? Static<S["querystring"]>
    : unknown;
  Params: S extends { params: TSchema } ? Static<S["params"]> : unknown;
  Headers: S extends { headers: TSchema } ? Static<S["headers"]> : unknown;
};

export interface ControllerOptions<Providers extends ProvidersMap> {
  deps?: Providers;
  build: ControllerBuilderCallback<Providers>;
}

export type ControllerBuilderCallback<
  Providers extends ProvidersMap = ProvidersMap,
> = (ctx: {
  builder: RoutesBuilder;
  deps: ExposeDeps<Providers>;
}) => unknown | Promise<unknown>;

export interface ControllerConfig<Providers extends ProvidersMap> {
  deps: Providers;
  build: ControllerBuilderCallback<Providers>;
  registerRoutes(
    fastify: FastifyInstance,
    container: Container,
    moduleName: string,
  ): Promise<void>;
}
