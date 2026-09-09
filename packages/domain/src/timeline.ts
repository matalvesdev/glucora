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
