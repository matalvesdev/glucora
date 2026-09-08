import { afterEach, describe, it, expect } from 'vitest';
import { buildApp } from '../services/api/src/app';
import { createLogger } from '../packages/observability/src/index';
import { captureLogs } from '../packages/test-utils/src/index';
import { Value } from '@sinclair/typebox/value';
import { HealthSchema, ErrorSchema } from '../packages/contracts/src/index';
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
  it('does not expose unimplemented health data capabilities', async () => {
    const { app } = setup();
    for (const url of ['/v1/observations', '/v1/consents', '/v1/chat'])
      expect((await app.inject(url)).statusCode).toBe(404);
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
