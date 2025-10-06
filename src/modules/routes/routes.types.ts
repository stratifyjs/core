import {
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
} from "../../hooks/hooks.types";

type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown>;

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

export interface StratifyRouteOptions extends BaseStratifyRouteOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  url: string;
  errorHandler?: ErrorHandler
  handler: RouteHandler;
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
