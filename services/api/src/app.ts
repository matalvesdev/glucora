import { createHash, randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import swagger from '@fastify/swagger';
import helmet from '@fastify/helmet';
import { Type } from '@sinclair/typebox';
import {
  ConsentDecisionResponseSchema,
  ConsentHistoryQuerySchema,
  ConsentHistoryResponseSchema,
  ConsentPurposeListSchema,
  CreateManualGlucoseObservationBodySchema,
  CreateConsultationReportBodySchema,
  ConsultationReportParamsSchema,
  ConsultationReportSchema,
  ConsultationQuestionBodySchema,
  ConsultationQuestionListSchema,
  ConsultationQuestionSchema,
  ShareGrantParamsSchema,
  CreateShareGrantBodySchema,
  ShareGrantSchema,
  RevokeShareGrantBodySchema,
  ListShareGrantsQuerySchema,
  ShareGrantListSchema,
  CorrectManualGlucoseObservationBodySchema,
  RecordConsentDecisionBodySchema,
  CreatePrivacyRequestBodySchema,
  CreateSupportRequestBodySchema,
  ErrorSchema,
  HealthSchema,
  IdempotencyHeadersSchema,
  MeSchema,
  ManualGlucoseObservationSchema,
  ManualGlucoseObservationListQuerySchema,
  ManualGlucoseObservationListSchema,
  TimelineListQuerySchema,
  TimelineListSchema,
  ListSupportRequestsQuerySchema,
  PrivacyRequestParamsSchema,
  PrivacyRequestListQuerySchema,
  PrivacyRequestListSchema,
  PrivacyRequestHistorySchema,
  PrivacyRequestSchema,
  StructuredExportDocumentSchema,
  AcknowledgeExportDeliveryBodySchema,
  SupportRequestListSchema,
  SupportRequestSchema,
} from '@glucora/contracts';
import type {
  ConsentHistoryItem,
  ConsentDecisionRecorder,
  ConsentPurposeRepository,
  ConsentRepository,
  ObservationRepository,
  ConsultationReportRepository,
  ConsultationQuestionRepository,
  TimelineRepository,
  IdentityPort,
  PrivacyRequestRepository,
  PrivacyRequest,
  SupportRequest,
  SupportRequestRepository,
  SupportRequestCategory,
  UserAccountRepository,
  ShareGrantRepository,
  DataExportSectionPort,
  ExportDeliveryRepository,
} from '@glucora/domain';
import {
  approvedManualGlucoseCatalog,
  approvedManualGlucoseType,
  approvedManualGlucoseUnit,
  authorizeConsumerCapability,
  evaluateObservationCatalog,
  validateTimelineListQuery,
  buildConsultationSummary,
} from '@glucora/domain';
import {
  createLogger,
  createNoopMetricSink,
  type MetricSink,
} from '@glucora/observability';
import { buildStructuredExportArtifact } from './modules/privacy/build-export-artifact';
export interface AppDependencies {
  checkReadiness: () => Promise<void>;
  identity?: IdentityPort<import('fastify').FastifyRequest>;
  users?: UserAccountRepository;
  consents?: ConsentRepository;
  consentPurposes?: ConsentPurposeRepository;
  consentDecisions?: ConsentDecisionRecorder;
  privacyRequests?: PrivacyRequestRepository;
  privacyRequestPolicy?: { readonly retentionPolicyRef: string };
  exportSections?: readonly DataExportSectionPort[];
  exportDeliveries?: ExportDeliveryRepository;
  supportRequests?: SupportRequestRepository;
  supportRequestPolicy?: { readonly retentionPolicyRef: string };
  observations?: ObservationRepository;
  timeline?: TimelineRepository;
  consultationReports?: ConsultationReportRepository;
  consultationQuestions?: ConsultationQuestionRepository;
  shareGrants?: ShareGrantRepository;
  sharingPolicy?: { readonly retentionPolicyRef: string };
  logger?: ReturnType<typeof createLogger>;
  metrics?: MetricSink;
  now?: () => Date;
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

function encodeObservationCursor(item: {
  readonly occurredAt: string;
  readonly id: string;
}): string {
  return Buffer.from(
    JSON.stringify({ occurredAt: item.occurredAt, observationId: item.id }),
  ).toString('base64url');
}

function decodeObservationCursor(value: string | undefined) {
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
      !('observationId' in parsed) ||
      typeof parsed.observationId !== 'string' ||
      !/^obs_[A-Za-z0-9_-]{16,64}$/.test(parsed.observationId)
    )
      return null;
    return { occurredAt: parsed.occurredAt, id: parsed.observationId };
  } catch {
    return null;
  }
}

function encodeTimelineCursor(item: {
  readonly occurredAt: string;
  readonly id: string;
}): string {
  return Buffer.from(
    JSON.stringify({ occurredAt: item.occurredAt, timelineItemId: item.id }),
  ).toString('base64url');
}

function decodeTimelineCursor(value: string | undefined) {
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
      !('timelineItemId' in parsed) ||
      typeof parsed.timelineItemId !== 'string' ||
      !/^tli_[A-Za-z0-9_-]{16,64}$/.test(parsed.timelineItemId)
    )
      return null;
    return { occurredAt: parsed.occurredAt, id: parsed.timelineItemId };
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
            version: value.version,
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
    routes.get(
      '/v1/timeline',
      {
        schema: {
          operationId: 'listOwnTimeline',
          querystring: TimelineListQuerySchema,
          response: {
            200: TimelineListSchema,
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
        if (!deps.timeline)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Timeline temporariamente indisponível.',
            request_id: request.id,
          });
        const query = request.query as {
          limit?: number;
          cursor?: string;
          source_kind?: 'observation' | 'context_event';
          occurred_from?: string;
          occurred_to?: string;
          category_system?: string;
          category_code?: string;
        };
        const before = decodeTimelineCursor(query.cursor);
        if (before === null)
          return reply.code(400).send({
            code: 'INVALID_CURSOR',
            message: 'Cursor inválido.',
            request_id: request.id,
          });
        if (
          (query.category_system === undefined) !==
          (query.category_code === undefined)
        )
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'Solicitação inválida.',
            request_id: request.id,
          });
        const limit = query.limit ?? 20;
        const timelineQuery = {
          limit: limit + 1,
          ...(query.source_kind ? { sourceKind: query.source_kind } : {}),
          ...(query.occurred_from ? { occurredFrom: query.occurred_from } : {}),
          ...(query.occurred_to ? { occurredTo: query.occurred_to } : {}),
          ...(query.category_system && query.category_code
            ? {
                category: {
                  system: query.category_system,
                  code: query.category_code,
                },
              }
            : {}),
          ...(before ? { before } : {}),
        };
        if (!validateTimelineListQuery(timelineQuery).ok)
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'Solicitação inválida.',
            request_id: request.id,
          });
        await deps.timeline.rebuild(actor.id, evaluatedAt);
        const values = await deps.timeline.list(actor.id, timelineQuery);
        const items = values.slice(0, limit);
        const groups = new Map<string, typeof items>();
        for (const item of items) {
          const localDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: item.observedTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(item.occurredAt));
          groups.set(localDate, [...(groups.get(localDate) ?? []), item]);
        }
        return {
          state: items.length === 0 ? ('empty' as const) : ('ready' as const),
          groups: [...groups].map(([localDate, grouped]) => ({
            local_date: localDate,
            items: grouped.map((item) => ({
              id: item.id,
              source_kind: item.sourceKind,
              source_type: item.sourceType,
              fact_class: item.factClass,
              category: item.category,
              occurred_at: item.occurredAt,
            })),
          })),
          next_cursor:
            values.length > limit && items.at(-1)
              ? encodeTimelineCursor(items.at(-1)!)
              : null,
          request_id: request.id,
        };
      },
    );
    routes.post(
      '/v1/consultation-reports',
      {
        schema: {
          operationId: 'createOwnConsultationReport',
          headers: IdempotencyHeadersSchema,
          body: CreateConsultationReportBodySchema,
          response: {
            201: ConsultationReportSchema,
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
        const now = new Date().toISOString();
        const purpose = (await deps.consentPurposes?.listPublished(now))?.find(
          (item) => item.purposeKey === 'self_care_health_data',
        );
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
            evaluatedAt: now,
          }).allowed
        )
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.timeline || !deps.consultationReports || !purpose)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Relatório temporariamente indisponível.',
            request_id: request.id,
          });
        const body = request.body as { from: string; to: string };
        if (
          Date.parse(body.from) >= Date.parse(body.to) ||
          Date.parse(body.to) > Date.parse(now)
        )
          return reply.code(400).send({
            code: 'INVALID_PERIOD',
            message: 'Período inválido.',
            request_id: request.id,
          });
        try {
          await deps.timeline.rebuild(actor.id, now);
          const items = [] as Awaited<
            ReturnType<TimelineRepository['list']>
          >[number][];
          let before: { occurredAt: string; id: string } | undefined;
          do {
            const page = await deps.timeline.list(actor.id, {
              limit: 100,
              occurredFrom: body.from,
              occurredTo: body.to,
              ...(before ? { before } : {}),
            });
            items.push(...page);
            const last = page.at(-1);
            before =
              page.length === 100 && last
                ? { occurredAt: last.occurredAt, id: last.id }
                : undefined;
          } while (before);
          const summary = buildConsultationSummary(
            { from: body.from, to: body.to },
            items,
            now,
          );
          if (!summary.ok)
            return reply.code(400).send({
              code: 'INVALID_PERIOD',
              message: 'Período inválido.',
              request_id: request.id,
            });
          const value = await deps.consultationReports.create({
            report: {
              id: `rpt_${randomUUID().replaceAll('-', '')}`,
              userId: actor.id,
              summary: summary.value,
              sourceRefs: items.map((item) => ({
                timelineItemId: item.id,
                sourceVersion: item.sourceVersion,
              })),
              createdAt: now,
            },
            idempotencyKey: (request.headers as { 'idempotency-key': string })[
              'idempotency-key'
            ],
            requestHash: createHash('sha256')
              .update(JSON.stringify({ from: body.from, to: body.to }))
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
            period: value.summary.period,
            generated_at: value.summary.generatedAt,
            total_records: value.summary.totalRecords,
            counts_by_category: value.summary.countsByCategory,
            counts_by_source_type: value.summary.countsBySourceType,
            limitations: value.summary.limitations,
            created_at: value.createdAt,
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
      '/v1/consultation-reports/:id',
      {
        schema: {
          operationId: 'getOwnConsultationReport',
          params: ConsultationReportParamsSchema,
          response: {
            200: ConsultationReportSchema,
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
        const now = new Date().toISOString();
        const purpose = (await deps.consentPurposes?.listPublished(now))?.find(
          (item) => item.purposeKey === 'self_care_health_data',
        );
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
            evaluatedAt: now,
          }).allowed
        )
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.consultationReports)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Relatório temporariamente indisponível.',
            request_id: request.id,
          });
        const value = await deps.consultationReports.findById(
          (request.params as { id: string }).id,
          actor.id,
        );
        if (!value)
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Relatório não encontrado.',
            request_id: request.id,
          });
        return {
          id: value.id,
          period: value.summary.period,
          generated_at: value.summary.generatedAt,
          total_records: value.summary.totalRecords,
          counts_by_category: value.summary.countsByCategory,
          counts_by_source_type: value.summary.countsBySourceType,
          limitations: value.summary.limitations,
          created_at: value.createdAt,
          request_id: request.id,
        };
      },
    );
    routes.post(
      '/v1/consultation-reports/:id/questions',
      {
        schema: {
          operationId: 'recordOwnConsultationQuestion',
          headers: IdempotencyHeadersSchema,
          params: ConsultationReportParamsSchema,
          body: ConsultationQuestionBodySchema,
          response: {
            201: ConsultationQuestionSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            404: ErrorSchema,
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
        const now = new Date().toISOString();
        const account = await deps.users?.findById(actor.id);
        const purpose = (await deps.consentPurposes?.listPublished(now))?.find(
          (item) => item.purposeKey === 'self_care_health_data',
        );
        const consent = purpose
          ? await deps.consents?.current(actor.id, purpose.id)
          : null;
        if (
          !authorizeConsumerCapability({
            actor,
            account: account ?? null,
            subjectUserId: actor.id,
            purpose: purpose ?? null,
            currentConsent: consent ?? null,
            evaluatedAt: now,
          }).allowed
        )
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (
          !deps.consultationReports ||
          !deps.consultationQuestions ||
          !purpose
        )
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Checklist temporariamente indisponível.',
            request_id: request.id,
          });
        const reportId = (request.params as { id: string }).id;
        if (!(await deps.consultationReports.findById(reportId, actor.id)))
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Relatório não encontrado.',
            request_id: request.id,
          });
        const body = request.body as {
          question_key:
            'review_records' | 'discuss_routine' | 'clarify_next_steps';
          action: 'added' | 'removed';
        };
        try {
          const value = await deps.consultationQuestions.record({
            event: {
              id: `rqe_${randomUUID().replaceAll('-', '')}`,
              reportId,
              userId: actor.id,
              questionKey: body.question_key,
              action: body.action,
              version: 1,
              occurredAt: now,
            },
            idempotencyKey: (request.headers as { 'idempotency-key': string })[
              'idempotency-key'
            ],
            requestHash: createHash('sha256')
              .update(`${reportId}|${body.question_key}|${body.action}`)
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
            question_key: value.questionKey,
            version: value.version,
            occurred_at: value.occurredAt,
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
      '/v1/consultation-reports/:id/questions',
      {
        schema: {
          operationId: 'listOwnConsultationQuestions',
          params: ConsultationReportParamsSchema,
          response: {
            200: ConsultationQuestionListSchema,
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
        const now = new Date().toISOString();
        const account = await deps.users?.findById(actor.id);
        const purpose = (await deps.consentPurposes?.listPublished(now))?.find(
          (item) => item.purposeKey === 'self_care_health_data',
        );
        const consent = purpose
          ? await deps.consents?.current(actor.id, purpose.id)
          : null;
        if (
          !authorizeConsumerCapability({
            actor,
            account: account ?? null,
            subjectUserId: actor.id,
            purpose: purpose ?? null,
            currentConsent: consent ?? null,
            evaluatedAt: now,
          }).allowed
        )
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (!deps.consultationReports || !deps.consultationQuestions)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Checklist temporariamente indisponível.',
            request_id: request.id,
          });
        const reportId = (request.params as { id: string }).id;
        if (!(await deps.consultationReports.findById(reportId, actor.id)))
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Relatório não encontrado.',
            request_id: request.id,
          });
        const items = await deps.consultationQuestions.listSelected(
          reportId,
          actor.id,
        );
        return {
          items: items.map((item) => ({
            id: item.id,
            question_key: item.questionKey,
            version: item.version,
            occurred_at: item.occurredAt,
          })),
          request_id: request.id,
        };
      },
    );
    routes.get(
      '/v1/observations',
      {
        schema: {
          operationId: 'listManualGlucoseObservations',
          querystring: ManualGlucoseObservationListQuerySchema,
          response: {
            200: ManualGlucoseObservationListSchema,
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
        if (!deps.observations)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Histórico temporariamente indisponível.',
            request_id: request.id,
          });
        const query = request.query as { limit?: number; cursor?: string };
        const before = decodeObservationCursor(query.cursor);
        if (before === null)
          return reply.code(400).send({
            code: 'INVALID_CURSOR',
            message: 'Cursor inválido.',
            request_id: request.id,
          });
        const limit = query.limit ?? 20;
        const values = await deps.observations.listCurrent(actor.id, {
          limit: limit + 1,
          type: approvedManualGlucoseType,
          unit: approvedManualGlucoseUnit,
          ...(before ? { before } : {}),
        });
        const items = values.slice(0, limit);
        const next = values.length > limit ? items.at(-1) : undefined;
        return {
          items: items.map((item) => ({
            id: item.id,
            decimal_value: item.quantity.decimalValue,
            occurred_at: item.occurredAt,
            source_type: 'manual' as const,
            version: item.version,
          })),
          next_cursor: next ? encodeObservationCursor(next) : null,
          request_id: request.id,
        };
      },
    );
    routes.put(
      '/v1/observations/:id',
      {
        schema: {
          operationId: 'correctManualGlucoseObservation',
          headers: IdempotencyHeadersSchema,
          params: Type.Object({
            id: Type.String({ pattern: '^obs_[A-Za-z0-9_-]{16,64}$' }),
          }),
          body: CorrectManualGlucoseObservationBodySchema,
          response: {
            200: ManualGlucoseObservationSchema,
            400: ErrorSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            404: ErrorSchema,
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
        const { id } = request.params as { id: string };
        const body = request.body as {
          expected_version: number;
          decimal_value: string;
          occurred_at: string;
          observed_timezone: string;
          utc_offset_minutes: number;
        };
        const current = await deps.observations.findCurrent(id, actor.id);
        if (
          !current ||
          current.sourceType !== 'manual' ||
          !evaluateObservationCatalog(current, approvedManualGlucoseCatalog)
            .allowed
        )
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Medição não encontrada.',
            request_id: request.id,
          });
        if (current.version !== body.expected_version)
          return reply.code(409).send({
            code: 'VERSION_CONFLICT',
            message: 'A medição foi alterada.',
            request_id: request.id,
          });
        const now = new Date().toISOString();
        const replacement = {
          ...current,
          quantity: {
            decimalValue: body.decimal_value,
            unit: approvedManualGlucoseUnit,
          },
          occurredAt: body.occurred_at,
          observedTimezone: body.observed_timezone,
          utcOffsetMinutes: body.utc_offset_minutes,
          recordedAt: now,
          ingestedAt: now,
          sourceId: `src_${randomUUID().replaceAll('-', '')}`,
          provenanceId: `prv_${randomUUID().replaceAll('-', '')}`,
          status: 'current' as const,
          version: current.version + 1,
          createdAt: now,
        };
        try {
          const value = await deps.observations.correctManualCapture({
            replacement,
            provenance: {
              id: replacement.provenanceId,
              userId: actor.id,
              sourceType: 'manual',
              sourceId: replacement.sourceId,
              methodCode: 'capillary_user_reported',
              transformationRef: null,
              recordedAt: now,
              createdAt: now,
            },
            idempotencyKey: (request.headers as { 'idempotency-key': string })[
              'idempotency-key'
            ],
            requestHash: createHash('sha256')
              .update(
                JSON.stringify({
                  id,
                  expectedVersion: body.expected_version,
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
          return {
            id: value.id,
            type: value.type,
            decimal_value: value.quantity.decimalValue,
            unit: value.quantity.unit,
            occurred_at: value.occurredAt,
            source_type: 'manual' as const,
            method: 'capillary_user_reported' as const,
            version: value.version,
            request_id: request.id,
          };
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
            error.message === 'Observation correction conflict'
          )
            return reply.code(409).send({
              code: 'VERSION_CONFLICT',
              message: 'A medição foi alterada.',
              request_id: request.id,
            });
          if (
            error instanceof Error &&
            (error.message === 'Invalid replacement observation' ||
              error.message === 'Invalid manual observation correction')
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
    routes.post(
      '/v1/privacy-requests/:id/export',
      {
        schema: {
          operationId: 'downloadStructuredExport',
          params: PrivacyRequestParamsSchema,
          response: {
            200: StructuredExportDocumentSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            404: ErrorSchema,
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
        const authenticatedAt = actor.authenticatedAt
          ? Date.parse(actor.authenticatedAt)
          : Number.NaN;
        const now = (deps.now?.() ?? new Date()).getTime();
        if (
          !Number.isFinite(authenticatedAt) ||
          authenticatedAt > now + 60_000 ||
          now - authenticatedAt > 10 * 60_000
        )
          return reply.code(403).send({
            code: 'RECENT_AUTHENTICATION_REQUIRED',
            message: 'Entre novamente para exportar seus dados.',
            request_id: request.id,
          });
        if (
          !deps.privacyRequests ||
          !deps.privacyRequestPolicy ||
          !deps.exportDeliveries ||
          !deps.exportSections?.length
        )
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Exportação temporariamente indisponível.',
            request_id: request.id,
          });
        const { id } = request.params as { id: string };
        let value = await deps.privacyRequests.findById(id, actor.id);
        if (!value)
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Recurso não encontrado.',
            request_id: request.id,
          });
        if (
          value.kind !== 'export' ||
          ![
            'requested',
            'identity_verification_required',
            'in_review',
          ].includes(value.status)
        )
          return reply.code(409).send({
            code: 'EXPORT_NOT_AVAILABLE',
            message: 'Este pedido não está disponível para exportação.',
            request_id: request.id,
          });
        const occurredAt = new Date(now).toISOString();
        if (value.status !== 'in_review') {
          value = await deps.privacyRequests.transition({
            requestId: value.id,
            userId: actor.id,
            expectedVersion: value.version,
            event: {
              id: `dse_${randomUUID().replaceAll('-', '')}`,
              requestId: value.id,
              userId: actor.id,
              fromStatus: value.status,
              toStatus: 'in_review',
              reasonCode: 'recent_identity_verified',
              occurredAt,
            },
            audit: {
              id: `aud_${randomUUID().replaceAll('-', '')}`,
              requestId: request.id,
              retentionPolicyRef: deps.privacyRequestPolicy.retentionPolicyRef,
              occurredAt,
            },
          });
        }
        const artifact = await buildStructuredExportArtifact({
          request: value,
          generatedAt: occurredAt,
          sections: deps.exportSections,
        });
        const deliveryId = `exp_${randomUUID().replaceAll('-', '')}`;
        await deps.exportDeliveries.recordGenerated({
          id: deliveryId,
          requestId: value.id,
          userId: actor.id,
          sha256: artifact.sha256,
          recordCount: artifact.recordCount,
          generatedAt: artifact.generatedAt,
          acknowledgedAt: null,
        });
        reply.header(
          'content-disposition',
          `attachment; filename="${artifact.fileName}"`,
        );
        reply.header('cache-control', 'no-store');
        reply.header('x-glucora-content-sha256', artifact.sha256);
        reply.header('x-glucora-export-delivery-id', deliveryId);
        reply.type(artifact.mediaType);
        return reply.send(Buffer.from(artifact.bytes));
      },
    );
    routes.post(
      '/v1/privacy-requests/:id/export-acknowledgements',
      {
        schema: {
          operationId: 'acknowledgeStructuredExport',
          params: PrivacyRequestParamsSchema,
          body: AcknowledgeExportDeliveryBodySchema,
          response: {
            200: PrivacyRequestSchema,
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
        if (!deps.exportDeliveries || !deps.privacyRequestPolicy)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Confirmação temporariamente indisponível.',
            request_id: request.id,
          });
        const { id } = request.params as { id: string };
        const body = request.body as { delivery_id: string; sha256: string };
        const occurredAt = (deps.now?.() ?? new Date()).toISOString();
        try {
          const value = await deps.exportDeliveries.acknowledgeAndFulfill({
            deliveryId: body.delivery_id,
            requestId: id,
            userId: actor.id,
            sha256: body.sha256,
            acknowledgedAt: occurredAt,
            eventId: `dse_${randomUUID().replaceAll('-', '')}`,
            auditId: `aud_${randomUUID().replaceAll('-', '')}`,
            auditRequestId: request.id,
            retentionPolicyRef: deps.privacyRequestPolicy.retentionPolicyRef,
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
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'Export delivery conflict'
          )
            return reply.code(409).send({
              code: 'EXPORT_DELIVERY_CONFLICT',
              message: 'A confirmação da exportação não corresponde ao pedido.',
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
    routes.post(
      '/v1/consultation-reports/:id/shares',
      {
        schema: {
          operationId: 'createOwnShareGrant',
          headers: IdempotencyHeadersSchema,
          params: ConsultationReportParamsSchema,
          body: CreateShareGrantBodySchema,
          response: {
            201: ShareGrantSchema,
            400: ErrorSchema,
            401: ErrorSchema,
            403: ErrorSchema,
            404: ErrorSchema,
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
        const now = new Date().toISOString();
        const account = await deps.users?.findById(actor.id);
        const purpose = (await deps.consentPurposes?.listPublished(now))?.find(
          (item) => item.purposeKey === 'self_care_health_data',
        );
        const consent = purpose
          ? await deps.consents?.current(actor.id, purpose.id)
          : null;
        if (
          !authorizeConsumerCapability({
            actor,
            account: account ?? null,
            subjectUserId: actor.id,
            purpose: purpose ?? null,
            currentConsent: consent ?? null,
            evaluatedAt: now,
          }).allowed
        )
          return reply.code(403).send({
            code: 'ACCESS_DENIED',
            message: 'Acesso não autorizado.',
            request_id: request.id,
          });
        if (
          !deps.shareGrants ||
          !deps.consultationReports ||
          !deps.sharingPolicy ||
          !purpose
        )
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Compartilhamento temporariamente indisponível.',
            request_id: request.id,
          });
        const reportId = (request.params as { id: string }).id;
        if (!(await deps.consultationReports.findById(reportId, actor.id)))
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Relatório não encontrado.',
            request_id: request.id,
          });
        const body = request.body as {
          recipient_ref: string;
          purpose_version_id: string;
          expires_at: string;
        };
        if (
          body.purpose_version_id !== purpose.id ||
          Date.parse(body.expires_at) <= Date.parse(now) ||
          Date.parse(body.expires_at) > Date.parse(now) + 7 * 86400000
        )
          return reply.code(400).send({
            code: 'INVALID_GRANT',
            message: 'Grant inválido.',
            request_id: request.id,
          });
        try {
          const value = await deps.shareGrants.create(
            {
              id: `shg_${randomUUID().replaceAll('-', '')}`,
              ownerUserId: actor.id,
              recipientRef: body.recipient_ref,
              resourceType: 'consultation_report',
              resourceId: reportId,
              purposeVersionId: purpose.id,
              status: 'active',
              version: 1,
              grantedAt: now,
              expiresAt: body.expires_at,
              revokedAt: null,
            },
            {
              id: `aud_${randomUUID().replaceAll('-', '')}`,
              requestId: request.id,
              retentionPolicyRef: deps.sharingPolicy.retentionPolicyRef,
              occurredAt: now,
            },
          );
          return reply.code(201).send({
            id: value.id,
            resource_type: value.resourceType,
            resource_id: value.resourceId,
            recipient_ref: value.recipientRef,
            purpose_version_id: value.purposeVersionId,
            status: value.status,
            version: value.version,
            granted_at: value.grantedAt,
            expires_at: value.expiresAt,
            revoked_at: value.revokedAt,
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
      '/v1/shares',
      {
        schema: {
          operationId: 'listOwnShareGrants',
          querystring: ListShareGrantsQuerySchema,
          response: {
            200: ShareGrantListSchema,
            401: ErrorSchema,
            400: ErrorSchema,
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
        if (!deps.shareGrants)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Compartilhamento temporariamente indisponível.',
            request_id: request.id,
          });
        const query = request.query as { limit?: number; cursor?: string };
        let before: string | undefined;
        if (query.cursor) {
          try {
            const parsed = JSON.parse(
              Buffer.from(query.cursor, 'base64url').toString('utf8'),
            ) as { grantedAt?: string; id?: string };
            if (
              !parsed.grantedAt ||
              !parsed.id ||
              !Number.isFinite(Date.parse(parsed.grantedAt))
            )
              throw new Error('invalid');
            before = query.cursor;
          } catch {
            return reply.code(400).send({
              code: 'INVALID_CURSOR',
              message: 'Cursor inválido.',
              request_id: request.id,
            });
          }
        }
        const limit = query.limit ?? 20;
        const values = await deps.shareGrants.listOwn(actor.id, {
          limit: limit + 1,
          ...(before ? { before } : {}),
        });
        const next = values.length > limit ? values[limit] : null;
        const encode = (value: { grantedAt: string; id: string }) =>
          Buffer.from(
            JSON.stringify({ grantedAt: value.grantedAt, id: value.id }),
          ).toString('base64url');
        return {
          items: values.slice(0, limit).map((value) => ({
            id: value.id,
            resource_type: value.resourceType,
            resource_id: value.resourceId,
            recipient_ref: value.recipientRef,
            purpose_version_id: value.purposeVersionId,
            status: value.status,
            version: value.version,
            granted_at: value.grantedAt,
            expires_at: value.expiresAt,
            revoked_at: value.revokedAt,
            request_id: request.id,
          })),
          next_cursor: next ? encode(next) : null,
          request_id: request.id,
        };
      },
    );
    routes.get(
      '/v1/shares/:id',
      {
        schema: {
          operationId: 'getOwnShareGrant',
          params: ShareGrantParamsSchema,
          response: {
            200: ShareGrantSchema,
            401: ErrorSchema,
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
        if (!deps.shareGrants)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Compartilhamento temporariamente indisponível.',
            request_id: request.id,
          });
        const value = await deps.shareGrants.findById(
          (request.params as { id: string }).id,
          actor.id,
        );
        if (!value)
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Grant não encontrado.',
            request_id: request.id,
          });
        return {
          id: value.id,
          resource_type: value.resourceType,
          resource_id: value.resourceId,
          recipient_ref: value.recipientRef,
          purpose_version_id: value.purposeVersionId,
          status: value.status,
          version: value.version,
          granted_at: value.grantedAt,
          expires_at: value.expiresAt,
          revoked_at: value.revokedAt,
          request_id: request.id,
        };
      },
    );
    routes.post(
      '/v1/shares/:id/revoke',
      {
        schema: {
          operationId: 'revokeOwnShareGrant',
          headers: IdempotencyHeadersSchema,
          params: ShareGrantParamsSchema,
          body: RevokeShareGrantBodySchema,
          response: {
            200: ShareGrantSchema,
            401: ErrorSchema,
            404: ErrorSchema,
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
        if (!deps.shareGrants || !deps.sharingPolicy)
          return reply.code(503).send({
            code: 'CAPABILITY_UNAVAILABLE',
            message: 'Compartilhamento temporariamente indisponível.',
            request_id: request.id,
          });
        const now = new Date().toISOString();
        const body = request.body as { expected_version: number };
        try {
          const value = await deps.shareGrants.revoke(
            (request.params as { id: string }).id,
            actor.id,
            body.expected_version,
            now,
            {
              id: `aud_${randomUUID().replaceAll('-', '')}`,
              requestId: request.id,
              retentionPolicyRef: deps.sharingPolicy.retentionPolicyRef,
              occurredAt: now,
            },
          );
          return {
            id: value.id,
            resource_type: value.resourceType,
            resource_id: value.resourceId,
            recipient_ref: value.recipientRef,
            purpose_version_id: value.purposeVersionId,
            status: value.status,
            version: value.version,
            granted_at: value.grantedAt,
            expires_at: value.expiresAt,
            revoked_at: value.revokedAt,
            request_id: request.id,
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes('conflict'))
            return reply.code(409).send({
              code: 'VERSION_CONFLICT',
              message: 'Versão do grant conflitante.',
              request_id: request.id,
            });
          throw error;
        }
      },
    );
  });
  return app;
}
