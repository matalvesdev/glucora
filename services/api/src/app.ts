import { createHash, randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import swagger from '@fastify/swagger';
import helmet from '@fastify/helmet';
import {
  ConsentDecisionResponseSchema,
  ConsentHistoryQuerySchema,
  ConsentHistoryResponseSchema,
  ConsentPurposeListSchema,
  CreateManualGlucoseObservationBodySchema,
  RecordConsentDecisionBodySchema,
  CreatePrivacyRequestBodySchema,
  CreateSupportRequestBodySchema,
  ErrorSchema,
  HealthSchema,
  IdempotencyHeadersSchema,
  MeSchema,
  ManualGlucoseObservationSchema,
  ListSupportRequestsQuerySchema,
  PrivacyRequestParamsSchema,
  PrivacyRequestListQuerySchema,
  PrivacyRequestListSchema,
  PrivacyRequestHistorySchema,
  PrivacyRequestSchema,
  SupportRequestListSchema,
  SupportRequestSchema,
} from '@glucora/contracts';
import type {
  ConsentHistoryItem,
  ConsentDecisionRecorder,
  ConsentPurposeRepository,
  ConsentRepository,
  ObservationRepository,
  IdentityPort,
  PrivacyRequestRepository,
  PrivacyRequest,
  SupportRequest,
  SupportRequestRepository,
  SupportRequestCategory,
  UserAccountRepository,
} from '@glucora/domain';
import {
  approvedManualGlucoseCatalog,
  approvedManualGlucoseType,
  approvedManualGlucoseUnit,
  authorizeConsumerCapability,
  evaluateObservationCatalog,
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
  consentPurposes?: ConsentPurposeRepository;
  consentDecisions?: ConsentDecisionRecorder;
  privacyRequests?: PrivacyRequestRepository;
  privacyRequestPolicy?: { readonly retentionPolicyRef: string };
  supportRequests?: SupportRequestRepository;
  supportRequestPolicy?: { readonly retentionPolicyRef: string };
  observations?: ObservationRepository;
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

function encodePrivacyRequestCursor(item: PrivacyRequest): string {
  return Buffer.from(
    JSON.stringify({ requestedAt: item.requestedAt, requestId: item.id }),
  ).toString('base64url');
}

function decodePrivacyRequestCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Object.keys(parsed).length !== 2 ||
      !('requestedAt' in parsed) ||
      typeof parsed.requestedAt !== 'string' ||
      !Number.isFinite(Date.parse(parsed.requestedAt)) ||
      !('requestId' in parsed) ||
      typeof parsed.requestId !== 'string' ||
      !/^dsr_[A-Za-z0-9_-]{16,64}$/.test(parsed.requestId)
    )
      return null;
    return { requestedAt: parsed.requestedAt, requestId: parsed.requestId };
  } catch {
    return null;
  }
}

function encodeSupportRequestCursor(item: SupportRequest): string {
  return Buffer.from(
    JSON.stringify({ createdAt: item.createdAt, requestId: item.id }),
  ).toString('base64url');
}

function decodeSupportRequestCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Object.keys(parsed).length !== 2 ||
      !('createdAt' in parsed) ||
      typeof parsed.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(parsed.createdAt)) ||
      !('requestId' in parsed) ||
      typeof parsed.requestId !== 'string' ||
      !/^sup_[A-Za-z0-9_-]{16,64}$/.test(parsed.requestId)
    )
      return null;
    return { createdAt: parsed.createdAt, requestId: parsed.requestId };
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
      '/v1/observations',
      {
        schema: {
          operationId: 'createManualGlucoseObservation',
          headers: IdempotencyHeadersSchema,
          body: CreateManualGlucoseObservationBodySchema,
          response: {
            201: ManualGlucoseObservationSchema,
            400: ErrorSchema,
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
        const evaluatedAt = new Date().toISOString();
        const purpose = (
          await deps.consentPurposes?.listPublished(evaluatedAt)
        )?.find((item) => item.purposeKey === 'self_care_health_data');
        const currentConsent = purpose
          ? await deps.consents?.current(actor.id, purpose.id)
          : null;
        if (
          !authorizeConsumerCapability({
            actor,
            account: account ?? null,
            subjectUserId: actor.id,
            purpose: purpose ?? null,
            currentConsent: currentConsent ?? null,
            evaluatedAt,
          }).allowed
        )
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.observations || !purpose)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Registro temporariamente indisponível.',
            request_id: request.id,
          });
        const body = request.body as {
          decimal_value: string;
          occurred_at: string;
          observed_timezone: string;
          utc_offset_minutes: number;
        };
        const headers = request.headers as { 'idempotency-key': string };
        const now = new Date().toISOString();
        const observation = {
          id: `obs_${randomUUID().replaceAll('-', '')}`,
          userId: actor.id,
          type: approvedManualGlucoseType,
          quantity: {
            decimalValue: body.decimal_value,
            unit: approvedManualGlucoseUnit,
          },
          occurredAt: body.occurred_at,
          observedTimezone: body.observed_timezone,
          utcOffsetMinutes: body.utc_offset_minutes,
          recordedAt: now,
          ingestedAt: now,
          sourceType: 'manual' as const,
          sourceId: `src_${randomUUID().replaceAll('-', '')}`,
          provenanceId: `prv_${randomUUID().replaceAll('-', '')}`,
          factClass: 'declaration' as const,
          status: 'current' as const,
          version: 1,
          createdAt: now,
        };
        if (
          !evaluateObservationCatalog(observation, approvedManualGlucoseCatalog)
            .allowed
        )
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Registro temporariamente indisponível.',
            request_id: request.id,
          });
        try {
          const value = await deps.observations.recordManualCapture({
            observation,
            provenance: {
              id: observation.provenanceId,
              userId: actor.id,
              sourceType: 'manual',
              sourceId: observation.sourceId,
              methodCode: 'capillary_user_reported',
              transformationRef: null,
              recordedAt: now,
              createdAt: now,
            },
            idempotencyKey: headers['idempotency-key'],
            requestHash: createHash('sha256')
              .update(
                JSON.stringify({
                  decimalValue: body.decimal_value,
                  occurredAt: body.occurred_at,
                  observedTimezone: body.observed_timezone,
                  utcOffsetMinutes: body.utc_offset_minutes,
                }),
              )
              .digest('hex'),
            audit: {
              id: `aud_${randomUUID().replaceAll('-', '')}`,
              requestId: request.id,
              retentionPolicyRef: purpose.retentionPolicyRef,
              occurredAt: now,
            },
          });
          return reply.code(201).send({
            id: value.id,
            type: value.type,
            decimal_value: value.quantity.decimalValue,
            unit: value.quantity.unit,
            occurred_at: value.occurredAt,
            source_type: 'manual',
            method: 'capillary_user_reported',
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
          if (
            error instanceof Error &&
            (error.message === 'Invalid observation' ||
              error.message === 'Invalid manual observation capture')
          )
            return reply.code(400).send({
              code: 'INVALID_OBSERVATION',
              message: 'Dados de medição inválidos.',
              request_id: request.id,
            });
          throw error;
        }
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
      '/v1/privacy-requests/:id/history',
      {
        schema: {
          operationId: 'getPrivacyRequestHistory',
          params: PrivacyRequestParamsSchema,
          response: {
            200: PrivacyRequestHistorySchema,
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
        const events = await deps.privacyRequests.history(id, actor.id);
        return {
          items: events.map((event) => ({
            from_status: event.fromStatus,
            to_status: event.toStatus,
            occurred_at: event.occurredAt,
          })),
          request_id: request.id,
        };
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
    routes.get(
      '/v1/privacy-requests',
      {
        schema: {
          operationId: 'listPrivacyRequests',
          querystring: PrivacyRequestListQuerySchema,
          response: {
            200: PrivacyRequestListSchema,
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
        if (!deps.privacyRequests)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Solicitações temporariamente indisponíveis.',
            request_id: request.id,
          });
        const query = request.query as { limit?: number; cursor?: string };
        const before = decodePrivacyRequestCursor(query.cursor);
        if (before === null)
          return reply.code(400).send({
            code: 'INVALID_CURSOR',
            message: 'Cursor inválido.',
            request_id: request.id,
          });
        const limit = query.limit ?? 20;
        const values = await deps.privacyRequests.listOwn(actor.id, {
          limit: limit + 1,
          ...(before ? { before } : {}),
        });
        const items = values.slice(0, limit);
        const next = values.length > limit ? items.at(-1) : undefined;
        return {
          items: items.map((value) => ({
            id: value.id,
            kind: value.kind,
            scope: value.scope,
            status: value.status,
            version: value.version,
            requested_at: value.requestedAt,
            updated_at: value.updatedAt,
          })),
          next_cursor: next ? encodePrivacyRequestCursor(next) : null,
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
      '/v1/consent-purposes',
      {
        schema: {
          operationId: 'listConsentPurposes',
          response: {
            200: ConsentPurposeListSchema,
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
        if (!deps.consentPurposes || !deps.consents)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Consentimentos temporariamente indisponíveis.',
            request_id: request.id,
          });
        const purposes = await deps.consentPurposes.listPublished(
          new Date().toISOString(),
        );
        const items = await Promise.all(
          purposes.map(async (purpose) => ({
            id: purpose.id,
            purpose_key: purpose.purposeKey,
            version: purpose.version,
            title: purpose.title,
            notice_text: purpose.noticeText,
            legal_basis_ref: purpose.legalBasisRef,
            retention_policy_ref: purpose.retentionPolicyRef,
            current_decision:
              (await deps.consents?.current(actor.id, purpose.id))?.decision ??
              null,
          })),
        );
        return { items, request_id: request.id };
      },
    );
    routes.post(
      '/v1/consent-decisions',
      {
        schema: {
          operationId: 'recordConsentDecision',
          headers: IdempotencyHeadersSchema,
          body: RecordConsentDecisionBodySchema,
          response: {
            201: ConsentDecisionResponseSchema,
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
        if (!deps.consentPurposes || !deps.consentDecisions)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Consentimentos temporariamente indisponíveis.',
            request_id: request.id,
          });
        const body = request.body as {
          purpose_version_id: string;
          decision: 'granted' | 'denied' | 'revoked';
        };
        const purpose = (
          await deps.consentPurposes.listPublished(new Date().toISOString())
        ).find((item) => item.id === body.purpose_version_id);
        if (!purpose)
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        const headers = request.headers as { 'idempotency-key': string };
        const occurredAt = new Date().toISOString();
        try {
          const event = await deps.consentDecisions.recordWithAudit({
            id: `cne_${randomUUID().replaceAll('-', '')}`,
            userId: actor.id,
            purposeVersionId: purpose.id,
            decision: body.decision,
            channel: 'web',
            idempotencyKey: headers['idempotency-key'],
            occurredAt,
            audit: {
              id: `aud_${randomUUID().replaceAll('-', '')}`,
              requestId: request.id,
              retentionPolicyRef: purpose.retentionPolicyRef,
              occurredAt,
            },
          });
          return reply.code(201).send({
            id: event.id,
            purpose_version_id: event.purposeVersionId,
            decision: event.decision,
            occurred_at: event.occurredAt,
            recorded_at: event.recordedAt,
            request_id: request.id,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message ===
              'Idempotency key reused with different consent data'
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
        if (!deps.supportRequests)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Suporte temporariamente indisponível.',
            request_id: request.id,
          });
        const query = request.query as { limit?: number; cursor?: string };
        const before = decodeSupportRequestCursor(query.cursor);
        if (before === null)
          return reply.code(400).send({
            code: 'INVALID_CURSOR',
            message: 'Cursor inválido.',
            request_id: request.id,
          });
        const limit = query.limit ?? 20;
        const values = await deps.supportRequests.listOwn(
          actor.id,
          before ? { limit: limit + 1, before } : { limit: limit + 1 },
        );
        const next = values.length > limit ? values[limit] : null;
        return {
          items: values.slice(0, limit).map((value) => ({
            id: value.id,
            category: value.category,
            status: value.status,
            created_at: value.createdAt,
          })),
          next_cursor: next ? encodeSupportRequestCursor(next) : null,
          request_id: request.id,
        };
      },
    );
  });
  return app;
}
