import { describe, expect, it } from 'vitest';
import {
  authorizeConsumerCapability,
  type ConsumerCapabilityContext,
} from '../packages/domain/src/index';

const evaluatedAt = '2026-01-02T00:00:00.000Z';
const base: ConsumerCapabilityContext = {
  actor: { id: 'usr_syntheticconsumer001', kind: 'consumer' },
  account: {
    id: 'usr_syntheticconsumer001',
    status: 'active',
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  subjectUserId: 'usr_syntheticconsumer001',
  purpose: {
    id: 'pur_syntheticpurpose001',
    status: 'published',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    retiredAt: null,
  },
  currentConsent: {
    id: 'cne_syntheticgrant00001',
    userId: 'usr_syntheticconsumer001',
    purposeVersionId: 'pur_syntheticpurpose001',
    decision: 'granted',
    channel: 'unit-test',
    idempotencyKey: ['test', 'grant', '1'].join('-'),
    occurredAt: '2026-01-01T01:00:00.000Z',
    recordedAt: '2026-01-01T01:00:01.000Z',
  },
  evaluatedAt,
};

describe('consumer capability authorization matrix', () => {
  it('allows only the matching active owner with active purpose and current grant', () => {
    expect(authorizeConsumerCapability(base)).toEqual({ allowed: true });
  });

  it.each([
    ['missing actor', { actor: null }, 'unauthenticated'],
    ['missing account', { account: null }, 'account_inactive'],
    [
      'disabled account',
      { account: { ...base.account!, status: 'disabled' as const } },
      'account_inactive',
    ],
    [
      'different subject',
      { subjectUserId: 'usr_syntheticconsumer002' },
      'subject_mismatch',
    ],
    ['missing purpose', { purpose: null }, 'purpose_unavailable'],
    [
      'draft purpose',
      { purpose: { ...base.purpose!, status: 'draft' as const } },
      'purpose_unavailable',
    ],
    [
      'future purpose',
      {
        purpose: {
          ...base.purpose!,
          effectiveFrom: '2026-01-03T00:00:00.000Z',
        },
      },
      'purpose_unavailable',
    ],
    [
      'malformed purpose time',
      { purpose: { ...base.purpose!, effectiveFrom: 'invalid' } },
      'purpose_unavailable',
    ],
    ['missing decision', { currentConsent: null }, 'consent_required'],
    [
      'revoked decision',
      {
        currentConsent: {
          ...base.currentConsent!,
          decision: 'revoked' as const,
        },
      },
      'consent_required',
    ],
    [
      'malformed consent time',
      {
        currentConsent: { ...base.currentConsent!, occurredAt: 'invalid' },
      },
      'consent_required',
    ],
    [
      'grant for another purpose',
      {
        currentConsent: {
          ...base.currentConsent!,
          purposeVersionId: 'pur_syntheticpurpose002',
        },
      },
      'consent_required',
    ],
  ])('denies %s', (_name, override, reason) => {
    expect(authorizeConsumerCapability({ ...base, ...override })).toEqual({
      allowed: false,
      reason,
    });
  });
});
