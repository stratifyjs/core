import { FastifyReply, FastifyRequest, RouteOptions } from "fastify";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtractRouteGenerics<S extends Record<string, unknown>> = {
  Body: S extends { body: TSchema } ? Static<S["body"]> : unknown;
  Querystring: S extends { querystring: TSchema }
    ? Static<S["querystring"]>
    : unknown;
  Params: S extends { params: TSchema } ? Static<S["params"]> : unknown;
  Headers: S extends { headers: TSchema } ? Static<S["headers"]> : unknown;
};
