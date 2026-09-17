import type {
  Coding,
  ObservationFactClass,
  ObservationSourceType,
} from './observation';

export interface TimelineItem {
  readonly id: string;
  readonly userId: string;
  readonly sourceKind: 'observation' | 'context_event';
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly category: Coding;
  readonly factClass: ObservationFactClass;
  readonly sourceType: ObservationSourceType;
  readonly occurredAt: string;
  readonly observedTimezone: string;
  readonly utcOffsetMinutes: number;
  readonly projectedAt: string;
}

export interface TimelineRepository {
  rebuild(userId: string, projectedAt: string): Promise<number>;
  list(
    userId: string,
    query: TimelineListQuery,
  ): Promise<readonly TimelineItem[]>;
}

export interface TimelineListQuery {
  readonly limit: number;
  readonly sourceKind?: TimelineItem['sourceKind'];
  readonly category?: Coding;
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
  readonly before?: { readonly occurredAt: string; readonly id: string };
}

export type TimelineQueryValidationError =
  | 'invalid_limit'
  | 'invalid_source_kind'
  | 'invalid_category'
  | 'invalid_occurred_from'
  | 'invalid_occurred_to'
  | 'invalid_occurred_range'
  | 'invalid_cursor';

export type TimelineQueryResult =
  | { readonly ok: true; readonly value: TimelineListQuery }
  | {
      readonly ok: false;
      readonly errors: readonly TimelineQueryValidationError[];
    };

const codingPart = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function parseUtcTimestamp(value: string): number | null {
  if (!utcTimestamp.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

export function validateTimelineListQuery(
  query: TimelineListQuery,
): TimelineQueryResult {
  const errors = new Set<TimelineQueryValidationError>();
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)
    errors.add('invalid_limit');
  if (
    query.sourceKind !== undefined &&
    query.sourceKind !== 'observation' &&
    query.sourceKind !== 'context_event'
  )
    errors.add('invalid_source_kind');
  if (
    query.category &&
    (!codingPart.test(query.category.system) ||
      !codingPart.test(query.category.code))
  )
    errors.add('invalid_category');
  const occurredFrom = query.occurredFrom
    ? parseUtcTimestamp(query.occurredFrom)
    : null;
  const occurredTo = query.occurredTo
    ? parseUtcTimestamp(query.occurredTo)
    : null;
  if (query.occurredFrom && occurredFrom === null)
    errors.add('invalid_occurred_from');
  if (query.occurredTo && occurredTo === null)
    errors.add('invalid_occurred_to');
  if (
    occurredFrom !== null &&
    occurredTo !== null &&
    occurredFrom >= occurredTo
  )
    errors.add('invalid_occurred_range');
  if (
    query.before &&
    (parseUtcTimestamp(query.before.occurredAt) === null ||
      !/^tli_[A-Za-z0-9_-]{16,64}$/.test(query.before.id))
  )
    errors.add('invalid_cursor');
  return errors.size === 0
    ? { ok: true, value: query }
    : { ok: false, errors: [...errors] };
}

export type TimelineView =
  | {
      readonly state: 'empty';
      readonly messageKey: 'timeline.no_records_not_no_events';
    }
  | { readonly state: 'ready'; readonly groups: readonly TimelineDayGroup[] };

export interface TimelineDayGroup {
  readonly localDate: string;
  readonly items: readonly TimelineItem[];
}

export function groupTimelineByLocalDate(
  items: readonly TimelineItem[],
): TimelineView {
  if (items.length === 0)
    return { state: 'empty', messageKey: 'timeline.no_records_not_no_events' };
  const groups = new Map<string, TimelineItem[]>();
  for (const item of items) {
    let localDate: string;
    try {
      localDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: item.observedTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(item.occurredAt));
    } catch {
      throw new Error('Invalid timeline timezone');
    }
    const group = groups.get(localDate) ?? [];
    group.push(item);
    groups.set(localDate, group);
  }
  return {
    state: 'ready',
    groups: [...groups].map(([localDate, grouped]) => ({
      localDate,
      items: grouped,
    })),
  };
}
