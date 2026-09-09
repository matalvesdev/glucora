import type {
  Coding,
  ObservationFactClass,
  ObservationSourceType,
  ProvenanceRecord,
} from './observation';

export type ContextEventStatus = 'current' | 'superseded' | 'entered_in_error';

export interface ContextEvent {
  readonly id: string;
  readonly userId: string;
  readonly category: Coding;
  readonly note: string | null;
  readonly occurredAt: string;
  readonly observedTimezone: string;
  readonly utcOffsetMinutes: number;
  readonly recordedAt: string;
  readonly ingestedAt: string;
  readonly sourceType: ObservationSourceType;
  readonly sourceId: string;
  readonly provenanceId: string;
  readonly factClass: ObservationFactClass;
  readonly status: ContextEventStatus;
  readonly version: number;
  readonly createdAt: string;
}

export interface ContextEventCatalog {
  supports(category: Coding): boolean;
}

export interface ContextEventRepository {
  recordInitial(
    event: ContextEvent,
    provenance: ProvenanceRecord,
  ): Promise<ContextEvent>;
  listCurrent(
    userId: string,
    query: ContextEventListQuery,
  ): Promise<readonly ContextEvent[]>;
}

export interface ContextEventListQuery {
  readonly limit: number;
  readonly before?: { readonly occurredAt: string; readonly id: string };
}

export type ContextEventValidationError =
  | 'invalid_id'
  | 'invalid_user_id'
  | 'invalid_category'
  | 'invalid_note'
  | 'invalid_timestamp'
  | 'invalid_temporal_order'
  | 'invalid_timezone'
  | 'invalid_source'
  | 'invalid_provenance_id'
  | 'invalid_fact_class'
  | 'invalid_status'
  | 'invalid_version';

const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const codingPart = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function time(value: string): number | null {
  if (!utcTimestamp.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

function offsetFor(value: string, zone: string): number | null {
  try {
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(value))
      .find((part) => part.type === 'timeZoneName')?.value;
    if (label === 'GMT') return 0;
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(label ?? '');
    if (!match) return null;
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] === '-' ? -minutes : minutes;
  } catch {
    return null;
  }
}

export function validateContextEvent(
  event: ContextEvent,
  catalog: ContextEventCatalog,
) {
  const errors = new Set<ContextEventValidationError>();
  if (!/^ctx_[A-Za-z0-9_-]{16,64}$/.test(event.id)) errors.add('invalid_id');
  if (!/^usr_[A-Za-z0-9_-]{16,64}$/.test(event.userId))
    errors.add('invalid_user_id');
  if (
    !codingPart.test(event.category.system) ||
    !codingPart.test(event.category.code) ||
    !catalog.supports(event.category)
  )
    errors.add('invalid_category');
  if (
    event.note !== null &&
    (event.note.trim() !== event.note ||
      event.note.length < 1 ||
      event.note.length > 500)
  )
    errors.add('invalid_note');
  const occurred = time(event.occurredAt),
    recorded = time(event.recordedAt),
    ingested = time(event.ingestedAt),
    created = time(event.createdAt);
  if ([occurred, recorded, ingested, created].includes(null))
    errors.add('invalid_timestamp');
  else if (
    occurred! > recorded! ||
    recorded! > ingested! ||
    ingested! > created!
  )
    errors.add('invalid_temporal_order');
  if (
    !Number.isInteger(event.utcOffsetMinutes) ||
    offsetFor(event.occurredAt, event.observedTimezone) !==
      event.utcOffsetMinutes
  )
    errors.add('invalid_timezone');
  if (
    !['manual', 'imported'].includes(event.sourceType) ||
    !/^[a-z]{3}_[A-Za-z0-9_-]{16,64}$/.test(event.sourceId)
  )
    errors.add('invalid_source');
  if (!/^prv_[A-Za-z0-9_-]{16,64}$/.test(event.provenanceId))
    errors.add('invalid_provenance_id');
  if (
    !['fact', 'declaration', 'clinical_assertion'].includes(event.factClass) ||
    event.factClass === 'inference'
  )
    errors.add('invalid_fact_class');
  if (!['current', 'superseded', 'entered_in_error'].includes(event.status))
    errors.add('invalid_status');
  if (!Number.isSafeInteger(event.version) || event.version < 1)
    errors.add('invalid_version');
  return errors.size === 0
    ? { ok: true as const, value: event }
    : { ok: false as const, errors: [...errors] };
}
