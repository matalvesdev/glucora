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
  readonly before?: { readonly occurredAt: string; readonly id: string };
}
