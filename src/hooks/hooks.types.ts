import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
  RegisterOptions,
  RequestPayload,
  RouteOptions,
} from "fastify";
import { ApplicationHook, LifecycleHook } from "fastify/types/hooks";

// --- HTTP  hooks ---
export type OnRequestHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown>;
export type OnPreParsingHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: RequestPayload,
) => Promise<unknown>;
export type OnPreValidationHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown>;
export type OnPreHandlerHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown>;
export type OnPreSerializationHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
) => Promise<unknown>;
export type OnErrorHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
) => Promise<unknown>;
export type OnSendHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
) => Promise<unknown>;
export type OnResponseHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown>;
export type OnTimeoutHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown>;
export type OnRequestAbortHandler = (
  request: FastifyRequest,
) => Promise<unknown>;

export type HttpHookName = LifecycleHook;

export type HttpHookMap = {
  onRequest: OnRequestHandler[];
  preParsing: OnPreParsingHandler[];
  preValidation: OnPreValidationHandler[];
  preHandler: OnPreHandlerHandler[];
  preSerialization: OnPreSerializationHandler[];
  onSend: OnSendHookHandler[];
  onResponse: OnResponseHandler[];
  onTimeout: OnTimeoutHandler[];
  onError: OnErrorHookHandler[];
  onRequestAbort: OnRequestAbortHandler[];
};

export type HttpHookHandlers<K extends keyof HttpHookMap> = HttpHookMap[K];
export type HttpHookHandler<K extends keyof HttpHookMap> =
  HttpHookHandlers<K>[number];

// --- Application hooks ---

export type OnReadyHandler =
  | (() => Promise<void>)
  | ((done: (err?: Error) => void) => void);

export type OnListenHandler = () => Promise<void>;

export type OnCloseHandler = () => Promise<void>;

export type OnPreCloseHandler = () => Promise<void>;

export type OnRouteHandler = (route: RouteOptions) => void;

export type OnRegisterHandler = (
  instance: FastifyInstance,
  opts: RegisterOptions & FastifyPluginOptions,
) => void;

export type AppHookName = ApplicationHook;

export type AppHookMap = {
  onReady: OnReadyHandler[];
  onClose: OnCloseHandler[];
  onListen: OnListenHandler[];
  onRoute: OnRouteHandler[];
  onRegister: OnRegisterHandler[];
  preClose: OnPreCloseHandler[];
};
