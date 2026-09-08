import type { FastifyRequest } from 'fastify';
import type { IdentityPort } from '@glucora/domain';

const actorIdPattern = /^usr_[A-Za-z0-9_-]{16,64}$/;

export function createDisabledIdentityAdapter(): IdentityPort<FastifyRequest> {
  return { authenticate: async () => null };
}

export function createDevelopmentIdentityAdapter(): IdentityPort<FastifyRequest> {
  return {
    authenticate: async (request) => {
      const value = request.headers['x-glucora-dev-actor'];
      if (typeof value !== 'string' || !actorIdPattern.test(value)) return null;
      return { id: value, kind: 'consumer' };
    },
  };
}
