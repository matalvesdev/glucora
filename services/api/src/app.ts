import { randomUUID } from 'node:crypto';
import Fastify, { LogController } from 'fastify';
import swagger from '@fastify/swagger';
import helmet from '@fastify/helmet';
import { HealthSchema, ErrorSchema } from '@glucora/contracts';
import { MeSchema } from '@glucora/contracts';
import type { IdentityPort, UserAccountRepository } from '@glucora/domain';
import {
  createLogger,
  createNoopMetricSink,
  type MetricSink,
} from '@glucora/observability';
export interface AppDependencies {
  checkReadiness: () => Promise<void>;
  identity?: IdentityPort<import('fastify').FastifyRequest>;
  users?: UserAccountRepository;
  logger?: ReturnType<typeof createLogger>;
  metrics?: MetricSink;
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
  });
  return app;
}
