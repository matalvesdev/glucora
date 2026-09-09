import { describe, expect, it } from 'vitest';
import {
  validateContextEvent,
  type ContextEvent,
} from '../packages/domain/src/index';

const event: ContextEvent = {
  id: 'ctx_syntheticevent00001',
  userId: 'usr_syntheticconsumer001',
  category: { system: 'synthetic.context', code: 'meal' },
  note: 'Synthetic note',
  occurredAt: '2026-01-01T10:00:00.000Z',
  observedTimezone: 'America/Sao_Paulo',
  utcOffsetMinutes: -180,
  recordedAt: '2026-01-01T10:01:00.000Z',
  ingestedAt: '2026-01-01T10:02:00.000Z',
  sourceType: 'manual',
  sourceId: 'src_syntheticcontext001',
  provenanceId: 'prv_syntheticcontext001',
  factClass: 'declaration',
  status: 'current',
  version: 1,
  createdAt: '2026-01-01T10:02:00.000Z',
};

describe('context event domain', () => {
  it('accepts a supported contextual declaration without interpreting it', () => {
    expect(
      validateContextEvent(event, { supports: ({ code }) => code === 'meal' }),
    ).toEqual({ ok: true, value: event });
  });
  it('denies categories absent from the injected catalog', () => {
    const result = validateContextEvent(event, { supports: () => false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('invalid_category');
  });
  it.each([
    [{ note: ' padded ' }, 'invalid_note'],
    [{ sourceType: 'derived' }, 'invalid_source'],
    [{ factClass: 'inference' }, 'invalid_fact_class'],
    [{ utcOffsetMinutes: 0 }, 'invalid_timezone'],
  ])('rejects unsafe or inconsistent context', (override, error) => {
    const result = validateContextEvent(
      { ...event, ...override } as ContextEvent,
      { supports: () => true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain(error);
  });
});
