import { describe, expect, it, vi } from 'vitest';
import {
  groupTimelineByLocalDate,
  validateTimelineListQuery,
  type ConsumerCapabilityContext,
  type TimelineItem,
  type TimelineRepository,
} from '../packages/domain/src/index';
import { readTimeline } from '../services/api/src/modules/timeline/read-timeline';

const item = (id: string, occurredAt: string): TimelineItem => ({
  id,
  userId: 'usr_syntheticconsumer001',
  sourceKind: 'context_event',
  sourceId: 'ctx_synthetictimeline001',
  sourceVersion: 1,
  category: { system: 'synthetic.context', code: 'meal' },
  factClass: 'declaration',
  sourceType: 'manual',
  occurredAt,
  observedTimezone: 'America/Sao_Paulo',
  utcOffsetMinutes: -180,
  projectedAt: '2026-01-02T00:00:00.000Z',
});
const allowed: ConsumerCapabilityContext = {
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
    id: 'pur_synthetictimeline001',
    status: 'published',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    retiredAt: null,
  },
  currentConsent: {
    id: 'cne_synthetictimeline001',
    userId: 'usr_syntheticconsumer001',
    purposeVersionId: 'pur_synthetictimeline001',
    decision: 'granted',
    channel: 'synthetic',
    idempotencyKey: 'synthetic-key',
    occurredAt: '2026-01-01T00:00:00.000Z',
    recordedAt: '2026-01-01T00:00:00.000Z',
  },
  evaluatedAt: '2026-01-02T00:00:00.000Z',
};

describe('timeline application', () => {
  it.each([
    [{ limit: 0 }, 'invalid_limit'],
    [{ limit: 10, sourceKind: 'other' }, 'invalid_source_kind'],
    [{ limit: 10, category: { system: '', code: 'meal' } }, 'invalid_category'],
    [{ limit: 10, occurredFrom: '2026-01-01' }, 'invalid_occurred_from'],
    [
      {
        limit: 10,
        occurredFrom: '2026-01-02T00:00:00.000Z',
        occurredTo: '2026-01-01T00:00:00.000Z',
      },
      'invalid_occurred_range',
    ],
    [
      { limit: 10, before: { occurredAt: '2026-01-01', id: 'bad' } },
      'invalid_cursor',
    ],
  ])('rejects malformed timeline query %#', (query, error) => {
    const result = validateTimelineListQuery(query as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain(error);
  });

  it('accepts a bounded timeline query with an opaque cursor', () => {
    expect(
      validateTimelineListQuery({
        limit: 20,
        sourceKind: 'context_event',
        category: { system: 'synthetic.context', code: 'meal' },
        occurredFrom: '2026-01-01T00:00:00.000Z',
        occurredTo: '2026-01-02T00:00:00.000Z',
        before: {
          occurredAt: '2026-01-01T12:00:00.000Z',
          id: 'tli_syntheticcursor001',
        },
      }),
    ).toMatchObject({ ok: true });
  });

  it('states explicitly that an empty projection does not prove events did not occur', () => {
    expect(groupTimelineByLocalDate([])).toEqual({
      state: 'empty',
      messageKey: 'timeline.no_records_not_no_events',
    });
  });
  it('groups by the local calendar date carried by each source', () => {
    const view = groupTimelineByLocalDate([
      item('tli_syntheticitem0001', '2026-01-02T01:00:00.000Z'),
      item('tli_syntheticitem0002', '2026-01-02T04:00:00.000Z'),
    ]);
    expect(view).toMatchObject({
      state: 'ready',
      groups: [{ localDate: '2026-01-01' }, { localDate: '2026-01-02' }],
    });
  });
  it('denies before querying when consent is absent', async () => {
    const repository = {
      list: vi.fn(),
      rebuild: vi.fn(),
    } as unknown as TimelineRepository;
    await expect(
      readTimeline(
        repository,
        { ...allowed, currentConsent: null },
        { limit: 20 },
      ),
    ).resolves.toEqual({ ok: false, reason: 'consent_required' });
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('queries only the authorized subject', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([]),
      rebuild: vi.fn(),
    } as unknown as TimelineRepository;
    await expect(
      readTimeline(repository, allowed, { limit: 20 }),
    ).resolves.toMatchObject({ ok: true, view: { state: 'empty' } });
    expect(repository.list).toHaveBeenCalledWith('usr_syntheticconsumer001', {
      limit: 20,
    });
  });
});
