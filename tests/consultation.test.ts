import { describe, expect, it } from 'vitest';
import {
  buildConsultationSummary,
  validateConsultationReport,
  type TimelineItem,
} from '../packages/domain/src/index';

const timelineItem: TimelineItem = {
  id: 'tli_syntheticitem0001',
  userId: 'usr_syntheticconsumer001',
  sourceKind: 'observation',
  sourceId: 'obs_syntheticmeasure0001',
  sourceVersion: 1,
  category: { system: 'synthetic.measurement', code: 'example' },
  factClass: 'declaration',
  sourceType: 'manual',
  occurredAt: '2026-01-02T12:00:00.000Z',
  observedTimezone: 'America/Sao_Paulo',
  utcOffsetMinutes: -180,
  projectedAt: '2026-01-08T00:00:00.000Z',
};
const period = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-01-08T00:00:00.000Z',
};

describe('deterministic consultation summary', () => {
  it('accepts only a self-consistent immutable report snapshot', () => {
    const summary = buildConsultationSummary(
      period,
      [timelineItem],
      '2026-01-08T00:00:00.000Z',
    );
    if (!summary.ok) throw new Error('Synthetic summary must be valid');
    const report = {
      id: 'rpt_syntheticreport0001',
      userId: timelineItem.userId,
      summary: summary.value,
      sourceRefs: [
        {
          timelineItemId: timelineItem.id,
          sourceVersion: timelineItem.sourceVersion,
        },
      ],
      createdAt: '2026-01-08T00:00:00.000Z',
    };
    expect(validateConsultationReport(report)).toMatchObject({ ok: true });
    expect(
      validateConsultationReport({
        ...report,
        summary: { ...report.summary, totalRecords: 2 },
      }),
    ).toEqual({
      ok: false,
      errors: ['invalid_summary', 'invalid_source_refs'],
    });
  });

  it('counts records without deriving a clinical interpretation', () => {
    expect(
      buildConsultationSummary(
        period,
        [timelineItem],
        '2026-01-08T00:00:00.000Z',
      ),
    ).toEqual({
      ok: true,
      value: {
        period,
        generatedAt: '2026-01-08T00:00:00.000Z',
        totalRecords: 1,
        countsByCategory: { 'synthetic.measurement|example': 1 },
        countsBySourceType: { manual: 1 },
        limitations: [
          'summary_is_descriptive_only',
          'missing_records_do_not_mean_events_did_not_happen',
          'record_count_does_not_measure_health_or_control',
        ],
      },
    });
  });
  it('makes the empty-period limitation explicit', () => {
    const result = buildConsultationSummary(
      period,
      [],
      '2026-01-08T00:00:00.000Z',
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        totalRecords: 0,
        limitations: expect.arrayContaining(['no_records_in_selected_period']),
      },
    });
  });
  it.each([
    [
      { from: period.to, to: period.from },
      [timelineItem],
      '2026-01-08T00:00:00.000Z',
      'invalid_period',
    ],
    [
      period,
      [{ ...timelineItem, occurredAt: period.to }],
      '2026-01-08T00:00:00.000Z',
      'item_outside_period',
    ],
    [
      period,
      [timelineItem],
      '2026-01-07T00:00:00.000Z',
      'invalid_generated_at',
    ],
  ])(
    'rejects inconsistent summary input',
    (range, items, generatedAt, reason) => {
      expect(
        buildConsultationSummary(range, items as TimelineItem[], generatedAt),
      ).toEqual({ ok: false, reason });
    },
  );
});
