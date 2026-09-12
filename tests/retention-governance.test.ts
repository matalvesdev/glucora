import { describe, expect, it } from 'vitest';
import {
  isRetentionHoldActive,
  type RetentionHoldEvent,
} from '../packages/domain/src/index';

const event = (
  id: string,
  eventType: RetentionHoldEvent['eventType'],
  occurredAt: string,
): RetentionHoldEvent => ({
  id,
  userId: 'usr_syntheticconsumer001',
  holdRef: 'hold-synthetic-0001',
  eventType,
  reasonCode: 'legal_hold_documented',
  responsibleRef: '00001',
  evidenceRef: 'evidence-synthetic-0001',
  occurredAt,
});

describe('retention hold ledger', () => {
  it('derives the state from the latest append-only event', () => {
    expect(
      isRetentionHoldActive(
        [
          event(
            'rhe_syntheticapplied001',
            'applied',
            '2026-01-01T00:00:00.000Z',
          ),
        ],
        'hold-synthetic-0001',
      ),
    ).toBe(true);
    expect(
      isRetentionHoldActive(
        [
          event(
            'rhe_syntheticapplied001',
            'applied',
            '2026-01-01T00:00:00.000Z',
          ),
          event(
            'rhe_syntheticreleased01',
            'released',
            '2026-01-02T00:00:00.000Z',
          ),
        ],
        'hold-synthetic-0001',
      ),
    ).toBe(false);
  });
});
