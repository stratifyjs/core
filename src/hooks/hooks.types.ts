import { FastifyReply, FastifyRequest, RequestPayload } from "fastify";

// --- HTTP  hooks ---
export type OnRequestHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export type OnPreParsingHandler = (request: FastifyRequest, reply: FastifyReply, payload: RequestPayload) => Promise<void>

export type OnPreValidationHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export type OnPreHandlerHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export type OnPreSerializationHandler = (request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<void>

export type OnErrorHookHandler = (request: FastifyRequest, reply: FastifyReply, error: unknown) => Promise<void>

export type OnSendHookHandler = (request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<void>

export type OnResponseHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export type OnTimeoutHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

export type OnRequestAbort = (request: FastifyRequest) => Promise<void>
