import { afterEach, describe, it, expect } from 'vitest';
import { buildApp } from '../services/api/src/app';
import { createLogger } from '../packages/observability/src/index';
import { captureLogs } from '../packages/test-utils/src/index';
import { Value } from '@sinclair/typebox/value';
import { HealthSchema, ErrorSchema } from '../packages/contracts/src/index';
import {
  MeSchema,
  ConsentDecisionResponseSchema,
  ConsentHistoryResponseSchema,
  ConsentPurposeListSchema,
  PrivacyRequestSchema,
  PrivacyRequestListSchema,
  SupportRequestListSchema,
  SupportRequestSchema,
  ManualGlucoseObservationSchema,
} from '../packages/contracts/src/index';
import { createDevelopmentIdentityAdapter } from '../services/api/src/modules/identity/identity-adapter';
import type {
  ConsentRepository,
  ConsentDecisionRecorder,
  ConsentPurposeRepository,
  PrivacyRequestRepository,
  SupportRequestRepository,
  ObservationRepository,
} from '../packages/domain/src/index';
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
function setup(ready: () => Promise<void> = async () => {}) {
  const logs = captureLogs();
  const app = buildApp({
    checkReadiness: ready,
    logger: createLogger('info', logs.stream),
  });
  apps.push(app);
  return { app, logs };
}
const syntheticAccount = {
  id: 'usr_syntheticconsumer001',
  status: 'active' as const,
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
describe('foundation HTTP contract and privacy', () => {
  it('returns schema-valid health and server-generated request correlation', async () => {
    const { app } = setup();
    const response = await app.inject({
      url: '/v1/health',
      headers: { 'x-request-id': 'untrusted-sensitive-value' },
    });
    expect(response.statusCode).toBe(200);
    expect(Value.Check(HealthSchema, response.json())).toBe(true);
    expect(response.headers['x-request-id']).toBe(response.json().request_id);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('separates liveness from dependency readiness', async () => {
    const { app } = setup(async () => {
      throw new Error('postgres://secret + synthetic-health-note');
    });
    expect((await app.inject('/v1/health')).statusCode).toBe(200);
    const response = await app.inject('/v1/ready');
    expect(response.statusCode).toBe(503);
    expect(Value.Check(ErrorSchema, response.json())).toBe(true);
    expect(response.body).not.toContain('secret');
  });
  it('emits bounded operational signals without request content', async () => {
    const records: unknown[] = [];
    let readinessFailures = 0;
    const logs = captureLogs();
    const app = buildApp({
      checkReadiness: async () => {
        throw new Error('synthetic-sensitive-detail');
      },
      logger: createLogger('info', logs.stream),
      metrics: {
        recordHttpRequest: (metric) => records.push(metric),
        recordReadinessFailure: () => readinessFailures++,
      },
    });
    apps.push(app);
    await app.inject({
      method: 'GET',
      url: '/v1/ready?note=synthetic-sensitive-detail',
      headers: { authorization: 'synthetic-sensitive-detail' },
    });
    expect(readinessFailures).toBe(1);
    expect(records).toMatchObject([
      { method: 'GET', route: '/v1/ready', statusCode: 503 },
    ]);
    expect(JSON.stringify(records)).not.toContain('synthetic-sensitive-detail');
  });
  it('removes nested health and credential fields from structured logs', () => {
    const logs = captureLogs();
    const logger = createLogger('info', logs.stream);
    logger.info({
      event: 'synthetic_event',
      nested: {
        token: 'synthetic-token',
        payload: { glucose: 'synthetic-health-value' },
        safe_code: 'safe',
      },
    });
    const text = logs.text();
    expect(text).toContain('safe_code');
    expect(text).not.toContain('synthetic-token');
    expect(text).not.toContain('synthetic-health-value');
  });
  it('does not expose unimplemented health data capabilities', async () => {
    const { app } = setup();
    for (const url of ['/v1/observations', '/v1/consents', '/v1/chat'])
      expect((await app.inject(url)).statusCode).toBe(404);
  });
  it('denies identity by default and accepts only a valid local synthetic actor', async () => {
    const { app: denied } = setup();
    expect((await denied.inject('/v1/me')).statusCode).toBe(401);
    const logs = captureLogs();
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: {
        findById: async (id) =>
          id === syntheticAccount.id ? syntheticAccount : null,
      },
      logger: createLogger('info', logs.stream),
    });
    apps.push(app);
    expect(
      (
        await app.inject({
          url: '/v1/me',
          headers: { 'x-glucora-dev-actor': 'invalid' },
        })
      ).statusCode,
    ).toBe(401);
    const response = await app.inject({
      url: '/v1/me',
      headers: { 'x-glucora-dev-actor': 'usr_syntheticconsumer001' },
    });
    expect(response.statusCode).toBe(200);
    expect(Value.Check(MeSchema, response.json())).toBe(true);
    expect(logs.text()).not.toContain('usr_syntheticconsumer001');
  });
  it('denies authenticated actors without an active application account', async () => {
    const logs = captureLogs();
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => null },
      logger: createLogger('info', logs.stream),
    });
    apps.push(app);
    const response = await app.inject({
      url: '/v1/me',
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain(syntheticAccount.id);
  });
  it('creates an owned privacy request only when policy is configured', async () => {
    const created: unknown[] = [];
    const privacyRequests = {
      create: async (
        input: Parameters<PrivacyRequestRepository['create']>[0],
      ) => {
        created.push(input);
        return input.request;
      },
      transition: async () => {
        throw new Error('not used');
      },
      findById: async () => null,
      history: async () => [],
      listOwn: async () => [],
    };
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => syntheticAccount },
      privacyRequests,
      privacyRequestPolicy: {
        retentionPolicyRef: 'synthetic-approved-policy',
      },
      logger: createLogger('silent'),
    });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/privacy-requests',
      headers: {
        'x-glucora-dev-actor': syntheticAccount.id,
        'idempotency-key': 'synthetic-key-1',
      },
      payload: { kind: 'export' },
    });
    expect(response.statusCode).toBe(201);
    expect(Value.Check(PrivacyRequestSchema, response.json())).toBe(true);
    expect(created).toMatchObject([
      {
        request: { userId: syntheticAccount.id, kind: 'export' },
        audit: { retentionPolicyRef: 'synthetic-approved-policy' },
      },
    ]);

    const unavailable = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => syntheticAccount },
      privacyRequests,
      logger: createLogger('silent'),
    });
    apps.push(unavailable);
    expect(
      (
        await unavailable.inject({
          method: 'POST',
          url: '/v1/privacy-requests',
          headers: {
            'x-glucora-dev-actor': syntheticAccount.id,
            'idempotency-key': 'synthetic-key-2',
          },
          payload: { kind: 'deletion' },
        })
      ).statusCode,
    ).toBe(503);
    expect(
      (
        await unavailable.inject({
          url: '/v1/privacy-requests/dsr_syntheticmissing0001',
          headers: { 'x-glucora-dev-actor': syntheticAccount.id },
        })
      ).statusCode,
    ).toBe(404);
  });
  it('reads privacy request status by ownership and validates the HTTP boundary', async () => {
    const stored = {
      id: 'dsr_syntheticrequest0001',
      userId: syntheticAccount.id,
      kind: 'export' as const,
      scope: 'all_user_data' as const,
      status: 'requested' as const,
      version: 1,
      requestedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    const privacyRequests: PrivacyRequestRepository = {
      create: async () => stored,
      transition: async () => stored,
      findById: async (id, userId) =>
        id === stored.id && userId === stored.userId ? stored : null,
      history: async (id, userId) =>
        id === stored.id && userId === stored.userId
          ? [
              {
                id: 'pre_syntheticevent00001',
                requestId: stored.id,
                userId: stored.userId,
                fromStatus: null,
                toStatus: 'requested',
                reasonCode: 'internal_synthetic_reason',
                occurredAt: stored.requestedAt,
              },
            ]
          : [],
      listOwn: async (userId) => (userId === stored.userId ? [stored] : []),
    };
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => syntheticAccount },
      privacyRequests,
      privacyRequestPolicy: { retentionPolicyRef: 'synthetic-policy' },
      logger: createLogger('silent'),
    });
    apps.push(app);
    const found = await app.inject({
      url: `/v1/privacy-requests/${stored.id}`,
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(found.statusCode).toBe(200);
    expect(Value.Check(PrivacyRequestSchema, found.json())).toBe(true);
    const history = await app.inject({
      url: `/v1/privacy-requests/${stored.id}/history`,
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json()).toMatchObject({
      items: [{ from_status: null, to_status: 'requested' }],
    });
    expect(history.body).not.toContain('internal_synthetic_reason');
    const listed = await app.inject({
      url: '/v1/privacy-requests?limit=1',
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(listed.statusCode).toBe(200);
    expect(Value.Check(PrivacyRequestListSchema, listed.json())).toBe(true);
    expect(listed.json()).toMatchObject({ items: [{ id: stored.id }] });
    expect(
      (
        await app.inject({
          url: '/v1/privacy-requests?cursor=invalid___',
          headers: { 'x-glucora-dev-actor': syntheticAccount.id },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/privacy-requests',
          headers: { 'x-glucora-dev-actor': syntheticAccount.id },
          payload: { kind: 'export', extra: 'synthetic-private-data' },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('creates and lists controlled support requests without free text', async () => {
    const stored = {
      id: 'sup_syntheticrequest0001',
      userId: syntheticAccount.id,
      category: 'technical_issue' as const,
      status: 'submitted' as const,
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    const later = {
      ...stored,
      id: 'sup_syntheticrequest0002',
      createdAt: '2026-01-03T00:00:00.000Z',
    };
    const pages: unknown[] = [];
    const supportRequests: SupportRequestRepository = {
      create: async (input) => ({
        ...input.request,
        createdAt: stored.createdAt,
      }),
      listOwn: async (userId, page) => {
        pages.push(page);
        return userId === syntheticAccount.id ? [later, stored] : [];
      },
    };
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => syntheticAccount },
      supportRequests,
      supportRequestPolicy: { retentionPolicyRef: 'synthetic-policy' },
      logger: createLogger('silent'),
    });
    apps.push(app);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/support-requests',
      headers: {
        'x-glucora-dev-actor': syntheticAccount.id,
        'idempotency-key': 'synthetic-support-1',
      },
      payload: { category: 'technical_issue' },
    });
    expect(created.statusCode).toBe(201);
    expect(Value.Check(SupportRequestSchema, created.json())).toBe(true);
    const listed = await app.inject({
      url: '/v1/support-requests?limit=1',
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(listed.statusCode).toBe(200);
    expect(Value.Check(SupportRequestListSchema, listed.json())).toBe(true);
    const listBody = listed.json<{ next_cursor: string | null }>();
    expect(listBody.next_cursor).toEqual(expect.any(String));
    const continued = await app.inject({
      url: `/v1/support-requests?limit=1&cursor=${listBody.next_cursor}`,
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(continued.statusCode).toBe(200);
    expect(pages).toEqual([
      { limit: 2 },
      {
        limit: 2,
        before: {
          createdAt: stored.createdAt,
          requestId: stored.id,
        },
      },
    ]);
    const invalidCursor = await app.inject({
      url: '/v1/support-requests?cursor=not-a-valid-cursor',
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(invalidCursor.statusCode).toBe(400);
    const rejected = await app.inject({
      method: 'POST',
      url: '/v1/support-requests',
      headers: {
        'x-glucora-dev-actor': syntheticAccount.id,
        'idempotency-key': 'synthetic-support-2',
      },
      payload: {
        category: 'technical_issue',
        message: 'synthetic health payload',
      },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.body).not.toContain('synthetic health payload');
  });
  it('lists only the authenticated user consent history with an opaque cursor', async () => {
    const queried: unknown[] = [];
    const history = [
      {
        eventId: 'cne_syntheticevent00002',
        purposeVersionId: 'pur_syntheticpurpose001',
        purposeKey: 'synthetic_context',
        purposeVersion: 1,
        purposeTitle: 'Synthetic purpose',
        noticeText: 'Synthetic notice.',
        decision: 'revoked' as const,
        occurredAt: '2026-01-03T00:00:00.000Z',
        recordedAt: '2026-01-03T00:00:01.000Z',
      },
      {
        eventId: 'cne_syntheticevent00001',
        purposeVersionId: 'pur_syntheticpurpose001',
        purposeKey: 'synthetic_context',
        purposeVersion: 1,
        purposeTitle: 'Synthetic purpose',
        noticeText: 'Synthetic notice.',
        decision: 'granted' as const,
        occurredAt: '2026-01-02T00:00:00.000Z',
        recordedAt: '2026-01-02T00:00:01.000Z',
      },
    ];
    const consents: ConsentRepository = {
      record: async () => {
        throw new Error('not used');
      },
      history: async () => [],
      current: async () => null,
      listHistory: async (userId, page) => {
        queried.push({ userId, page });
        return history;
      },
    };
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => syntheticAccount },
      consents,
      logger: createLogger('silent'),
    });
    apps.push(app);
    const response = await app.inject({
      url: '/v1/consents/history?limit=1',
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(response.statusCode).toBe(200);
    expect(Value.Check(ConsentHistoryResponseSchema, response.json())).toBe(
      true,
    );
    expect(response.json()).toMatchObject({
      items: [{ decision: 'revoked' }],
    });
    expect(response.json().next_cursor).toEqual(expect.any(String));
    expect(queried).toEqual([
      { userId: syntheticAccount.id, page: { limit: 2 } },
    ]);
    expect(
      (
        await app.inject({
          url: '/v1/consents/history?cursor=invalid___',
          headers: { 'x-glucora-dev-actor': syntheticAccount.id },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('lists only published consent purposes and records an auditable decision', async () => {
    const purposes: ConsentPurposeRepository = {
      listPublished: async () => [
        {
          id: 'pur_syntheticpurpose001',
          purposeKey: 'self_care_health_data',
          version: 1,
          status: 'published',
          title: 'Synthetic self-care purpose',
          noticeText: 'Synthetic consent notice.',
          legalBasisRef: 'LGPD art. 11, I',
          retentionPolicyRef: 'synthetic-retention-policy',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          retiredAt: null,
        },
      ],
    };
    const recorded: unknown[] = [];
    const recorder: ConsentDecisionRecorder = {
      recordWithAudit: async (input) => {
        recorded.push(input);
        return {
          id: input.id,
          userId: input.userId,
          purposeVersionId: input.purposeVersionId,
          decision: input.decision,
          channel: input.channel,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
          recordedAt: input.occurredAt,
        };
      },
    };
    const consents: ConsentRepository = {
      record: async () => {
        throw new Error('not used');
      },
      history: async () => [],
      current: async () => null,
      listHistory: async () => [],
    };
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => syntheticAccount },
      consents,
      consentPurposes: purposes,
      consentDecisions: recorder,
      logger: createLogger('silent'),
    });
    apps.push(app);
    const listed = await app.inject({
      url: '/v1/consent-purposes',
      headers: { 'x-glucora-dev-actor': syntheticAccount.id },
    });
    expect(listed.statusCode).toBe(200);
    expect(Value.Check(ConsentPurposeListSchema, listed.json())).toBe(true);
    expect(listed.json()).toMatchObject({
      items: [{ current_decision: null, purpose_key: 'self_care_health_data' }],
    });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/consent-decisions',
      headers: {
        'x-glucora-dev-actor': syntheticAccount.id,
        'idempotency-key': 'synthetic-consent-decision-1',
      },
      payload: {
        purpose_version_id: 'pur_syntheticpurpose001',
        decision: 'granted',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(Value.Check(ConsentDecisionResponseSchema, created.json())).toBe(
      true,
    );
    expect(recorded).toMatchObject([
      {
        userId: syntheticAccount.id,
        purposeVersionId: 'pur_syntheticpurpose001',
        decision: 'granted',
        channel: 'web',
        audit: { retentionPolicyRef: 'synthetic-retention-policy' },
      },
    ]);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/consent-decisions',
          headers: {
            'x-glucora-dev-actor': syntheticAccount.id,
            'idempotency-key': 'synthetic-consent-decision-2',
          },
          payload: {
            purpose_version_id: 'pur_syntheticmissing0001',
            decision: 'granted',
          },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/consent-decisions',
          headers: {
            'x-glucora-dev-actor': syntheticAccount.id,
            'idempotency-key': 'synthetic-consent-decision-3',
          },
          payload: {
            purpose_version_id: 'pur_syntheticpurpose001',
            decision: 'granted',
            extra: 'synthetic-health-content',
          },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('records only the approved manual glucose capture with active consent and idempotency', async () => {
    const captures: Parameters<
      ObservationRepository['recordManualCapture']
    >[0][] = [];
    const observation = {
      recordManualCapture: async (
        input: Parameters<ObservationRepository['recordManualCapture']>[0],
      ) => {
        const prior = captures.find(
          (item) => item.idempotencyKey === input.idempotencyKey,
        );
        if (prior && prior.requestHash !== input.requestHash)
          throw new Error('Idempotency key reused');
        captures.push(input);
        return (prior ?? input).observation;
      },
      recordInitial: async () => {
        throw new Error('not used');
      },
      findCurrent: async () => null,
      correct: async () => {
        throw new Error('not used');
      },
      listCurrent: async () => [],
    } satisfies ObservationRepository;
    const purpose = {
      id: 'pur_selfcarehealth0001',
      purposeKey: 'self_care_health_data',
      version: 1,
      status: 'published' as const,
      title: 'Synthetic health purpose',
      noticeText: 'Synthetic consent notice.',
      legalBasisRef: 'synthetic-legal-ref',
      retentionPolicyRef: 'synthetic-retention-ref',
      effectiveFrom: '2020-01-01T00:00:00.000Z',
      retiredAt: null,
    };
    const app = buildApp({
      checkReadiness: async () => {},
      identity: createDevelopmentIdentityAdapter(),
      users: { findById: async () => syntheticAccount },
      consentPurposes: { listPublished: async () => [purpose] },
      consents: {
        record: async () => {
          throw new Error('not used');
        },
        history: async () => [],
        listHistory: async () => [],
        current: async () => ({
          id: 'cne_syntheticgrant00001',
          userId: syntheticAccount.id,
          purposeVersionId: purpose.id,
          decision: 'granted',
          channel: 'synthetic',
          idempotencyKey: 'synthetic-grant-key',
          occurredAt: '2026-01-01T00:00:00.000Z',
          recordedAt: '2026-01-01T00:00:00.000Z',
        }),
      },
      observations: observation,
    });
    apps.push(app);
    const input = {
      decimal_value: '101.25',
      occurred_at: '2026-01-01T10:00:00.000Z',
      observed_timezone: 'America/Sao_Paulo',
      utc_offset_minutes: -180,
    };
    const headers = {
      'x-glucora-dev-actor': syntheticAccount.id,
      'idempotency-key': 'synthetic-glucose-capture-1',
    };
    const response = await app.inject({
      method: 'POST',
      url: '/v1/observations',
      headers,
      payload: input,
    });
    expect(response.statusCode).toBe(201);
    expect(Value.Check(ManualGlucoseObservationSchema, response.json())).toBe(
      true,
    );
    expect(response.json()).toMatchObject({
      type: { system: 'http://loinc.org', code: '2339-0' },
      unit: { system: 'http://unitsofmeasure.org', code: 'mg/dL' },
      decimal_value: '101.25',
      source_type: 'manual',
      method: 'capillary_user_reported',
    });
    expect(captures).toHaveLength(1);
    expect(captures[0]!.provenance.methodCode).toBe('capillary_user_reported');
    expect(captures[0]!.audit.retentionPolicyRef).toBe(
      'synthetic-retention-ref',
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/observations',
          headers,
          payload: { ...input, decimal_value: '102' },
        })
      ).statusCode,
    ).toBe(409);
  });
  it('does not log request payloads, headers, URL values or upstream error details', async () => {
    const { app, logs } = setup(async () => {
      throw new Error('sensitive-upstream-detail');
    });
    await app.inject({
      method: 'POST',
      url: '/missing/synthetic-note?health=synthetic-value',
      headers: {
        authorization: 'Bearer synthetic-token',
        cookie: 'session=synthetic-cookie',
        'x-request-id': 'synthetic-id',
      },
      payload: { note: 'synthetic-body' },
    });
    await app.inject('/v1/ready');
    const text = logs.text();
    for (const value of [
      'synthetic-note',
      'synthetic-value',
      'synthetic-token',
      'synthetic-cookie',
      'synthetic-body',
      'synthetic-id',
      'sensitive-upstream-detail',
    ])
      expect(text).not.toContain(value);
    expect(text).toContain('http_request_completed');
    expect(text).toContain('request_id');
  });
  it('sanitizes unexpected and validation errors', async () => {
    const { app } = setup();
    app.post(
      '/test-validation',
      {
        schema: {
          body: {
            type: 'object',
            required: ['count'],
            properties: { count: { type: 'integer' } },
            additionalProperties: false,
          },
        },
      },
      async () => ({ ok: true }),
    );
    app.get('/test-failure', () => {
      throw new Error('sensitive-internal-detail');
    });
    const validation = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: { count: 'synthetic-health-note' },
    });
    expect(validation.statusCode).toBe(400);
    expect(validation.body).not.toContain('synthetic-health-note');
    const failure = await app.inject('/test-failure');
    expect(failure.statusCode).toBe(500);
    expect(Value.Check(ErrorSchema, failure.json())).toBe(true);
    expect(failure.body).not.toContain('sensitive-internal-detail');
  });
  it('rejects oversized inputs without echoing the payload', async () => {
    const { app } = setup();
    app.post('/test-size', async () => ({ ok: true }));
    const response = await app.inject({
      method: 'POST',
      url: '/test-size',
      payload: { note: 'x'.repeat(40000) },
    });
    expect(response.statusCode).toBe(413);
    expect(Value.Check(ErrorSchema, response.json())).toBe(true);
  });
});
