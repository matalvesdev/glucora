import pino, { type DestinationStream } from 'pino';
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
