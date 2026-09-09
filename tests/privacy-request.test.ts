import { describe, expect, it } from 'vitest';
import {
  canTransitionPrivacyRequest,
  type PrivacyRequestStatus,
} from '../packages/domain/src/index';

describe('privacy request lifecycle', () => {
  it.each([
    ['requested', 'identity_verification_required'],
    ['requested', 'in_review'],
    ['identity_verification_required', 'in_review'],
    ['in_review', 'fulfilled'],
    ['in_review', 'partially_fulfilled'],
    ['in_review', 'denied'],
  ] as const)('allows governed transition %s -> %s', (from, to) => {
    expect(canTransitionPrivacyRequest(from, to)).toBe(true);
  });
  it.each([
    ['requested', 'fulfilled'],
    ['fulfilled', 'in_review'],
    ['denied', 'requested'],
  ] as [PrivacyRequestStatus, PrivacyRequestStatus][])(
    'blocks invalid transition %s -> %s',
    (from, to) => {
      expect(canTransitionPrivacyRequest(from, to)).toBe(false);
    },
  );
});
