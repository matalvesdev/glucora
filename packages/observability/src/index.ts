import pino, { type DestinationStream } from 'pino';

const excludedLogFields = new Set([
  'authorization',
  'cookie',
  'password',
  'token',
  'body',
  'headers',
  'req',
  'res',
  'err',
  'url',
  'payload',
  'context',
  'prompt',
  'response',
  'content',
  'data',
  'metadata',
  'attributes',
  'note',
]);

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value))
    return value.map((item) => sanitizeLogValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !excludedLogFields.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitizeLogValue(item, depth + 1)]),
  );
}

export function createLogger(level = 'info', stream?: DestinationStream) {
  const options = {
    level,
    base: { service: 'glucora-api' },
    redact: {
      paths: [
        'authorization',
        'cookie',
        'password',
        'token',
        'body',
        'headers',
        'req',
        'res',
        'err',
        'url',
      ],
      remove: true,
    },
    formatters: {
      log: (object: Record<string, unknown>) =>
        sanitizeLogValue(object) as Record<string, unknown>,
    },
  };
  return stream ? pino(options, stream) : pino(options);
}

export interface HttpMetric {
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
}

export interface MetricSink {
  recordHttpRequest(metric: HttpMetric): void;
  recordReadinessFailure(): void;
}

export function createNoopMetricSink(): MetricSink {
  return { recordHttpRequest: () => {}, recordReadinessFailure: () => {} };
}
