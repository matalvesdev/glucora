import type { TimelineItem } from './timeline';

export interface ConsultationPeriod {
  readonly from: string;
  readonly to: string;
}

export interface ConsultationSummary {
  readonly period: ConsultationPeriod;
  readonly generatedAt: string;
  readonly totalRecords: number;
  readonly countsByCategory: Readonly<Record<string, number>>;
  readonly countsBySourceType: Readonly<Record<string, number>>;
  readonly limitations: readonly ConsultationLimitation[];
}

export type ConsultationLimitation =
  | 'summary_is_descriptive_only'
  | 'missing_records_do_not_mean_events_did_not_happen'
  | 'record_count_does_not_measure_health_or_control'
  | 'no_records_in_selected_period';

export type ConsultationSummaryResult =
  | { readonly ok: true; readonly value: ConsultationSummary }
  | {
      readonly ok: false;
      readonly reason:
        'invalid_period' | 'item_outside_period' | 'invalid_generated_at';
    };

export interface ConsultationReport {
  readonly id: string;
  readonly userId: string;
  readonly summary: ConsultationSummary;
  readonly sourceRefs: readonly {
    readonly timelineItemId: string;
    readonly sourceVersion: number;
  }[];
  readonly createdAt: string;
}

export interface CreateConsultationReport {
  readonly report: ConsultationReport;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly audit: {
    readonly id: string;
    readonly requestId: string;
    readonly retentionPolicyRef: string;
    readonly occurredAt: string;
  };
}

export interface ConsultationReportRepository {
  create(input: CreateConsultationReport): Promise<ConsultationReport>;
  findById(id: string, userId: string): Promise<ConsultationReport | null>;
}

const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const instant = (value: string) => {
  if (!utc.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
};

export function buildConsultationSummary(
  period: ConsultationPeriod,
  items: readonly TimelineItem[],
  generatedAt: string,
): ConsultationSummaryResult {
  const from = instant(period.from),
    to = instant(period.to),
    generated = instant(generatedAt);
  if (from === null || to === null || from >= to)
    return { ok: false, reason: 'invalid_period' };
  if (generated === null || generated < to)
    return { ok: false, reason: 'invalid_generated_at' };
  const countsByCategory: Record<string, number> = {};
  const countsBySourceType: Record<string, number> = {};
  for (const item of items) {
    const occurred = instant(item.occurredAt);
    if (occurred === null || occurred < from || occurred >= to)
      return { ok: false, reason: 'item_outside_period' };
    const category = `${item.category.system}|${item.category.code}`;
    countsByCategory[category] = (countsByCategory[category] ?? 0) + 1;
    countsBySourceType[item.sourceType] =
      (countsBySourceType[item.sourceType] ?? 0) + 1;
  }
  const limitations: ConsultationLimitation[] = [
    'summary_is_descriptive_only',
    'missing_records_do_not_mean_events_did_not_happen',
    'record_count_does_not_measure_health_or_control',
  ];
  if (items.length === 0) limitations.push('no_records_in_selected_period');
  return {
    ok: true,
    value: {
      period,
      generatedAt,
      totalRecords: items.length,
      countsByCategory,
      countsBySourceType,
      limitations,
    },
  };
}
