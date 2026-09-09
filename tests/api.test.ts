import { afterEach, describe, it, expect } from 'vitest';
import { buildApp } from '../services/api/src/app';
import { createLogger } from '../packages/observability/src/index';
import { captureLogs } from '../packages/test-utils/src/index';
import { Value } from '@sinclair/typebox/value';
import { HealthSchema, ErrorSchema } from '../packages/contracts/src/index';
import { MeSchema } from '../packages/contracts/src/index';
import { createDevelopmentIdentityAdapter } from '../services/api/src/modules/identity/identity-adapter';
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
