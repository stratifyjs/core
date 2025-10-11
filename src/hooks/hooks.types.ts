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
import { HttpHooksBuilder } from "./http-hooks-builder";
import { ExposeDeps, ProvidersMap } from "../providers";
import { Container } from "../container/container";
import { AppHooksBuilder } from "./application-hooks-builder";
import { AdapterMap, AdapterValues } from "../fastify";

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

type HttpHooksBuilderCallback<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
> = (ctx: {
  builder: HttpHooksBuilder;
  deps: ExposeDeps<Providers>;
  adaps: AdapterValues<Adaps>;
}) => unknown | Promise<unknown>;

export interface HttpHooksOptions<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
> {
  readonly type: "http";
  readonly deps?: Providers;
  readonly adaps?: Adaps;
  readonly name?: string;
  readonly build: HttpHooksBuilderCallback<Providers, Adaps>;
}

export interface HttpHooksConfig<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
> {
  readonly type: "http";
  readonly deps: Providers;
  readonly adaps: Adaps;
  readonly name: string;
  readonly build: HttpHooksBuilderCallback<Providers, Adaps>;
  register(
    fastify: FastifyInstance,
    container: Container,
    moduleName: string,
  ): Promise<void>;
}

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

type ApplicationHooksBuilderCallback<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
> = (ctx: {
  builder: AppHooksBuilder;
  deps: ExposeDeps<Providers>;
  adaps: AdapterValues<Adaps>;
}) => unknown | Promise<unknown>;

export interface AppHooksOptions<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
> {
  readonly type: "app";
  readonly deps?: Providers;
  readonly adaps?: Adaps;
  readonly name?: string;
  readonly build: ApplicationHooksBuilderCallback<Providers, Adaps>;
}

export interface AppHooksConfig<
  Providers extends ProvidersMap,
  Adaps extends AdapterMap,
> {
  readonly type: "app";
  readonly deps: Providers;
  readonly adaps: Adaps;
  readonly name: string;
  readonly build: ApplicationHooksBuilderCallback<Providers, Adaps>;
  register(
    fastify: FastifyInstance,
    container: Container,
    moduleName: string,
  ): Promise<void>;
}
