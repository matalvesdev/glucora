import { describe, expect, it } from 'vitest';
import { createIdentityPlatformIdentityAdapter } from '../services/api/src/modules/identity/identity-adapter';

const request = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} }) as never;

describe('Identity Platform adapter boundary', () => {
  it('resolves a verified external subject to the internal consumer only', async () => {
    const adapter = createIdentityPlatformIdentityAdapter({
      verifier: {
        verify: async () => ({
          subject: 'provider-subject-001',
          authenticatedAt: '2026-01-01T00:00:00.000Z',
        }),
      },
      subjects: {
        resolveConsumerId: async (subject) =>
          subject === 'provider-subject-001'
            ? 'usr_syntheticconsumer001'
            : null,
      },
    });
    await expect(
      adapter.authenticate(request('Bearer synthetic-token')),
    ).resolves.toEqual({
      id: 'usr_syntheticconsumer001',
      kind: 'consumer',
      authenticatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('fails closed for a missing mapping, malformed header or verifier failure', async () => {
    const adapter = createIdentityPlatformIdentityAdapter({
      verifier: { verify: async () => null },
      subjects: { resolveConsumerId: async () => 'usr_syntheticconsumer001' },
    });
    await expect(adapter.authenticate(request())).resolves.toBeNull();
    await expect(
      adapter.authenticate(request('Basic token')),
    ).resolves.toBeNull();
    await expect(
      adapter.authenticate(request('Bearer synthetic-token')),
    ).resolves.toBeNull();
  });
});
