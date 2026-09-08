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
