import { createHash, randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import swagger from '@fastify/swagger';
import helmet from '@fastify/helmet';
import {
  ConsentHistoryQuerySchema,
  ConsentHistoryResponseSchema,
  CreatePrivacyRequestBodySchema,
  CreateSupportRequestBodySchema,
  ErrorSchema,
  HealthSchema,
  IdempotencyHeadersSchema,
  MeSchema,
  ListSupportRequestsQuerySchema,
  PrivacyRequestParamsSchema,
  PrivacyRequestSchema,
  SupportRequestListSchema,
  SupportRequestSchema,
} from '@glucora/contracts';
import type {
  ConsentHistoryItem,
  ConsentRepository,
  IdentityPort,
  PrivacyRequestRepository,
  SupportRequestRepository,
  SupportRequestCategory,
  UserAccountRepository,
} from '@glucora/domain';
import {
  createLogger,
  createNoopMetricSink,
  type MetricSink,
} from '@glucora/observability';
export interface AppDependencies {
  checkReadiness: () => Promise<void>;
  identity?: IdentityPort<import('fastify').FastifyRequest>;
  users?: UserAccountRepository;
  consents?: ConsentRepository;
  privacyRequests?: PrivacyRequestRepository;
  privacyRequestPolicy?: { readonly retentionPolicyRef: string };
  supportRequests?: SupportRequestRepository;
  supportRequestPolicy?: { readonly retentionPolicyRef: string };
  logger?: ReturnType<typeof createLogger>;
  metrics?: MetricSink;
}

function encodeConsentCursor(item: ConsentHistoryItem): string {
  return Buffer.from(
    JSON.stringify({ occurredAt: item.occurredAt, eventId: item.eventId }),
  ).toString('base64url');
}

function decodeConsentCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Object.keys(parsed).length !== 2 ||
      !('occurredAt' in parsed) ||
      typeof parsed.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(parsed.occurredAt)) ||
      !('eventId' in parsed) ||
      typeof parsed.eventId !== 'string' ||
      !/^cne_[A-Za-z0-9_-]{16,64}$/.test(parsed.eventId)
    )
      return null;
    return { occurredAt: parsed.occurredAt, eventId: parsed.eventId };
  } catch {
    return null;
  }
}

export function buildApp(deps: AppDependencies) {
  const metrics = deps.metrics ?? createNoopMetricSink();
  const app = Fastify({
    loggerInstance: deps.logger ?? createLogger(),
    logController: new LogController({
      disableRequestLogging: true,
      requestIdLogLabel: 'request_id',
    }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: 32768,
    requestTimeout: 10000,
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.register(helmet);
  app.register(swagger, {
    openapi: {
      info: { title: 'Glucora API', version: '0.1.0' },
      openapi: '3.0.3',
    },
  });
  app.addHook('onRequest', async (request, reply) => {
    reply
      .header('x-request-id', request.id)
      .header('cache-control', 'no-store');
  });
  app.addHook('onResponse', async (request, reply) => {
    metrics.recordHttpRequest({
      method: request.method,
      route: request.routeOptions.url ?? 'unmatched',
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
    request.log.info(
      {
        event: 'http_request_completed',
        method: request.method,
        route: request.routeOptions.url ?? 'unmatched',
        status_code: reply.statusCode,
        duration_ms: Math.round(reply.elapsedTime),
      },
      'Request completed',
    );
  });
  app.setErrorHandler((error, request, reply) => {
    const candidate =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 500;
    const status = candidate >= 400 && candidate < 500 ? candidate : 500;
    // Never serialize raw errors: validation inputs, SQL and credentials may appear in messages.
    request.log.warn(
      { event: 'http_request_failed', status_code: status },
      'Request failed',
    );
    reply.code(status).send({
      code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
      message:
        status === 500
          ? 'Não foi possível concluir a solicitação.'
          : 'Solicitação inválida.',
      request_id: request.id,
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
      request_id: request.id,
    }),
  );
  app.register(async (routes) => {
    routes.get(
      '/v1/health',
      { schema: { operationId: 'getHealth', response: { 200: HealthSchema } } },
      async (request) => ({ status: 'ok' as const, request_id: request.id }),
    );
    routes.get(
      '/v1/ready',
      {
        schema: {
          operationId: 'getReadiness',
          response: { 200: HealthSchema, 503: ErrorSchema },
        },
      },
      async (request, reply) => {
        try {
          await deps.checkReadiness();
          return { status: 'ok' as const, request_id: request.id };
        } catch {
          metrics.recordReadinessFailure();
          return reply.code(503).send({
            code: 'NOT_READY',
            message: 'Serviço temporariamente indisponível.',
            request_id: request.id,
          });
        }
      },
    );
    routes.get(
      '/v1/me',
      {
        schema: {
          operationId: 'getCurrentUser',
          response: { 200: MeSchema, 401: ErrorSchema, 403: ErrorSchema },
        },
      },
      async (request, reply) => {
        const actor = await deps.identity?.authenticate(request);
        if (!actor)
          return reply.code(401).send({
            code: 'UNAUTHENTICATED',
            message: 'Autenticação necessária.',
            request_id: request.id,
          });
        const account = await deps.users?.findById(actor.id);
        if (!account || account.status !== 'active')
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        return {
          id: account.id,
          kind: actor.kind,
          status: account.status,
          locale: account.locale,
          timezone: account.timezone,
          created_at: account.createdAt,
          updated_at: account.updatedAt,
          request_id: request.id,
        };
      },
    );
    routes.post(
      '/v1/privacy-requests',
      {
        schema: {
          operationId: 'createPrivacyRequest',
          headers: IdempotencyHeadersSchema,
          body: CreatePrivacyRequestBodySchema,
          response: {
            201: PrivacyRequestSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            409: ErrorSchema,
            503: ErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const actor = await deps.identity?.authenticate(request);
        if (!actor)
          return reply.code(401).send({
            code: 'UNAUTHENTICATED',
            message: 'Autenticação necessária.',
            request_id: request.id,
          });
        const account = await deps.users?.findById(actor.id);
        if (!account || account.status !== 'active')
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.privacyRequests || !deps.privacyRequestPolicy)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Solicitação temporariamente indisponível.',
            request_id: request.id,
          });
        const body = request.body as { kind: 'access' | 'export' | 'deletion' };
        const headers = request.headers as { 'idempotency-key': string };
        const occurredAt = new Date().toISOString();
        const id = `dsr_${randomUUID().replaceAll('-', '')}`;
        try {
          const value = await deps.privacyRequests.create({
            request: {
              id,
              userId: actor.id,
              kind: body.kind,
              scope: 'all_user_data',
              status: 'requested',
              version: 1,
              requestedAt: occurredAt,
              updatedAt: occurredAt,
            },
            event: {
              id: `dse_${randomUUID().replaceAll('-', '')}`,
              requestId: id,
              userId: actor.id,
              fromStatus: null,
              toStatus: 'requested',
              reasonCode: 'user_requested',
              occurredAt,
            },
            idempotencyKey: headers['idempotency-key'],
            requestHash: createHash('sha256')
              .update(`${body.kind}|all_user_data`)
              .digest('hex'),
            audit: {
              id: `aud_${randomUUID().replaceAll('-', '')}`,
              requestId: request.id,
              retentionPolicyRef: deps.privacyRequestPolicy.retentionPolicyRef,
              occurredAt,
            },
          });
          return reply.code(201).send({
            id: value.id,
            kind: value.kind,
            scope: value.scope,
            status: value.status,
            version: value.version,
            requested_at: value.requestedAt,
            updated_at: value.updatedAt,
            request_id: request.id,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'Idempotency key reused'
          )
            return reply.code(409).send({
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'A chave de idempotência já foi utilizada.',
              request_id: request.id,
            });
          throw error;
        }
      },
    );
    routes.get(
      '/v1/privacy-requests/:id',
      {
        schema: {
          operationId: 'getPrivacyRequest',
          params: PrivacyRequestParamsSchema,
          response: {
            200: PrivacyRequestSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            404: ErrorSchema,
            503: ErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const actor = await deps.identity?.authenticate(request);
        if (!actor)
          return reply.code(401).send({
            code: 'UNAUTHENTICATED',
            message: 'Autenticação necessária.',
            request_id: request.id,
          });
        const account = await deps.users?.findById(actor.id);
        if (!account || account.status !== 'active')
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.privacyRequests)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Solicitação temporariamente indisponível.',
            request_id: request.id,
          });
        const { id } = request.params as { id: string };
        const value = await deps.privacyRequests.findById(id, actor.id);
        if (!value)
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Recurso não encontrado.',
            request_id: request.id,
          });
        return {
          id: value.id,
          kind: value.kind,
          scope: value.scope,
          status: value.status,
          version: value.version,
          requested_at: value.requestedAt,
          updated_at: value.updatedAt,
          request_id: request.id,
        };
      },
    );
    routes.post(
      '/v1/support-requests',
      {
        schema: {
          operationId: 'createSupportRequest',
          headers: IdempotencyHeadersSchema,
          body: CreateSupportRequestBodySchema,
          response: {
            201: SupportRequestSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            409: ErrorSchema,
            503: ErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const actor = await deps.identity?.authenticate(request);
        if (!actor)
          return reply.code(401).send({
            code: 'UNAUTHENTICATED',
            message: 'Autenticação necessária.',
            request_id: request.id,
          });
        const account = await deps.users?.findById(actor.id);
        if (!account || account.status !== 'active')
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.supportRequests || !deps.supportRequestPolicy)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Suporte temporariamente indisponível.',
            request_id: request.id,
          });
        const body = request.body as { category: SupportRequestCategory };
        const headers = request.headers as { 'idempotency-key': string };
        const occurredAt = new Date().toISOString();
        try {
          const value = await deps.supportRequests.create({
            request: {
              id: `sup_${randomUUID().replaceAll('-', '')}`,
              userId: actor.id,
              category: body.category,
              status: 'submitted',
              createdAt: occurredAt,
            },
            idempotencyKey: headers['idempotency-key'],
            requestHash: createHash('sha256')
              .update(body.category)
              .digest('hex'),
            audit: {
              id: `aud_${randomUUID().replaceAll('-', '')}`,
              requestId: request.id,
              retentionPolicyRef: deps.supportRequestPolicy.retentionPolicyRef,
              occurredAt,
            },
          });
          return reply.code(201).send({
            id: value.id,
            category: value.category,
            status: value.status,
            created_at: value.createdAt,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'Idempotency key reused'
          )
            return reply.code(409).send({
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'A chave de idempotência já foi utilizada.',
              request_id: request.id,
            });
          throw error;
        }
      },
    );
    routes.get(
      '/v1/consents/history',
      {
        schema: {
          operationId: 'listConsentHistory',
          querystring: ConsentHistoryQuerySchema,
          response: {
            200: ConsentHistoryResponseSchema,
            400: ErrorSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            503: ErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const actor = await deps.identity?.authenticate(request);
        if (!actor)
          return reply.code(401).send({
            code: 'UNAUTHENTICATED',
            message: 'Autenticação necessária.',
            request_id: request.id,
          });
        const account = await deps.users?.findById(actor.id);
        if (!account || account.status !== 'active')
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.consents)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Histórico temporariamente indisponível.',
            request_id: request.id,
          });
        const query = request.query as { limit?: number; cursor?: string };
        const before = decodeConsentCursor(query.cursor);
        if (before === null)
          return reply.code(400).send({
            code: 'INVALID_CURSOR',
            message: 'Cursor inválido.',
            request_id: request.id,
          });
        const limit = query.limit ?? 20;
        const values = await deps.consents.listHistory(actor.id, {
          limit: limit + 1,
          ...(before ? { before } : {}),
        });
        const items = values.slice(0, limit);
        const next = values.length > limit ? items.at(-1) : undefined;
        return {
          items: items.map((item) => ({
            event_id: item.eventId,
            purpose_version_id: item.purposeVersionId,
            purpose_key: item.purposeKey,
            purpose_version: item.purposeVersion,
            purpose_title: item.purposeTitle,
            notice_text: item.noticeText,
            decision: item.decision,
            occurred_at: item.occurredAt,
            recorded_at: item.recordedAt,
          })),
          next_cursor: next ? encodeConsentCursor(next) : null,
          request_id: request.id,
        };
      },
    );
    routes.get(
      '/v1/support-requests',
      {
        schema: {
          operationId: 'listSupportRequests',
          querystring: ListSupportRequestsQuerySchema,
          response: {
            200: SupportRequestListSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            503: ErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const actor = await deps.identity?.authenticate(request);
        if (!actor)
          return reply.code(401).send({
            code: 'UNAUTHENTICATED',
            message: 'Autenticação necessária.',
            request_id: request.id,
          });
        const account = await deps.users?.findById(actor.id);
        if (!account || account.status !== 'active')
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.supportRequests)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Suporte temporariamente indisponível.',
            request_id: request.id,
          });
        const query = request.query as { limit?: number };
        const values = await deps.supportRequests.listOwn(
          actor.id,
          query.limit ?? 20,
        );
        return {
          items: values.map((value) => ({
            id: value.id,
            category: value.category,
            status: value.status,
            created_at: value.createdAt,
          })),
          request_id: request.id,
        };
      },
    );
  });
  return app;
}
