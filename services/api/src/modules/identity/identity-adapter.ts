import type { FastifyRequest } from 'fastify';
import type { IdentityPort } from '@glucora/domain';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

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

export interface IdentityPlatformTokenVerifier {
  verify(token: string): Promise<{ readonly subject: string } | null>;
}

export interface IdentitySubjectResolver {
  resolveConsumerId(subject: string): Promise<string | null>;
}

export function createIdentityPlatformIdentityAdapter(input: {
  readonly verifier: IdentityPlatformTokenVerifier;
  readonly subjects: IdentitySubjectResolver;
}): IdentityPort<FastifyRequest> {
  return {
    authenticate: async (request) => {
      const header = request.headers.authorization;
      if (typeof header !== 'string' || !header.startsWith('Bearer '))
        return null;
      const token = header.slice('Bearer '.length);
      if (!token || token.length > 8192) return null;
      try {
        const verified = await input.verifier.verify(token);
        if (!verified) return null;
        const id = await input.subjects.resolveConsumerId(verified.subject);
        return id ? { id, kind: 'consumer' } : null;
      } catch {
        return null;
      }
    },
  };
}

function validPastTimestamp(value: unknown, now: number) {
  return typeof value === 'number' && Number.isFinite(value) && value <= now;
}

function validSubject(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

export function createIdentityPlatformTokenVerifier(input: {
  readonly projectId: string;
  readonly now?: () => number;
}): IdentityPlatformTokenVerifier {
  const issuer = `https://securetoken.google.com/${input.projectId}`;
  const keys = createRemoteJWKSet(
    new URL(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    ),
  );
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ['RS256'],
        audience: input.projectId,
        issuer,
      });
      const now = Math.floor((input.now?.() ?? Date.now()) / 1000);
      if (
        !validSubject(payload.sub) ||
        !validPastTimestamp(payload.iat, now) ||
        !validPastTimestamp(payload.auth_time, now) ||
        !isFiniteFutureExpiration(payload, now)
      )
        return null;
      return { subject: payload.sub };
    },
  };
}

function isFiniteFutureExpiration(payload: JWTPayload, now: number) {
  return (
    typeof payload.exp === 'number' &&
    Number.isFinite(payload.exp) &&
    payload.exp > now
  );
}
