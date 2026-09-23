export type ObservationFactClass =
  'fact' | 'declaration' | 'derivation' | 'inference' | 'clinical_assertion';

export type ObservationSourceType = 'manual' | 'imported' | 'derived';
export type ObservationStatus = 'current' | 'superseded' | 'entered_in_error';

export interface Coding {
  readonly system: string;
  readonly code: string;
}

export interface Quantity {
  readonly decimalValue: string;
  readonly unit: Coding;
}

export interface QuantitativeObservation {
  readonly id: string;
  readonly userId: string;
  readonly type: Coding;
  readonly quantity: Quantity;
  readonly occurredAt: string;
  readonly observedTimezone: string;
  readonly utcOffsetMinutes: number;
  readonly recordedAt: string;
  readonly ingestedAt: string;
  readonly sourceType: ObservationSourceType;
  readonly sourceId: string;
  readonly provenanceId: string;
  readonly factClass: ObservationFactClass;
  readonly status: ObservationStatus;
  readonly version: number;
  readonly createdAt: string;
}

export interface ProvenanceRecord {
  readonly id: string;
  readonly userId: string;
  readonly sourceType: ObservationSourceType;
  readonly sourceId: string;
  /** A controlled capture method when one is known; never inferred from value or time. */
  readonly methodCode?: 'capillary_user_reported' | null;
  readonly transformationRef: string | null;
  readonly recordedAt: string;
  readonly createdAt: string;
}

export interface ObservationRepository {
  recordInitial(
    observation: QuantitativeObservation,
    provenance: ProvenanceRecord,
  ): Promise<QuantitativeObservation>;
  recordManualCapture(
    input: ManualObservationCapture,
  ): Promise<QuantitativeObservation>;
  findCurrent(
    id: string,
    userId: string,
  ): Promise<QuantitativeObservation | null>;
  correct(input: ObservationCorrection): Promise<QuantitativeObservation>;
  correctManualCapture(
    input: ManualObservationCorrection,
  ): Promise<QuantitativeObservation>;
  listCurrent(
    userId: string,
    query: ObservationListQuery,
  ): Promise<readonly QuantitativeObservation[]>;
}

export interface ManualObservationCapture {
  readonly observation: QuantitativeObservation;
  readonly provenance: ProvenanceRecord;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly audit: {
    readonly id: string;
    readonly requestId: string;
    readonly retentionPolicyRef: string;
    readonly occurredAt: string;
  };
}

export interface ObservationListQuery {
  readonly limit: number;
  readonly type?: Coding;
  readonly unit?: Coding;
  readonly before?: { readonly occurredAt: string; readonly id: string };
}

export interface ObservationCatalog {
  supports(type: Coding, unit: Coding): boolean;
}

export type CatalogDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: 'unsupported_type_or_unit' };

export function evaluateObservationCatalog(
  observation: QuantitativeObservation,
  catalog: ObservationCatalog,
): CatalogDecision {
  return catalog.supports(observation.type, observation.quantity.unit)
    ? { allowed: true }
    : { allowed: false, reason: 'unsupported_type_or_unit' };
}

export interface ObservationCorrection {
  readonly replacement: QuantitativeObservation;
  readonly provenance: ProvenanceRecord;
  readonly audit: {
    readonly id: string;
    readonly requestId: string;
    readonly retentionPolicyRef: string;
    readonly occurredAt: string;
  };
}

export interface ManualObservationCorrection extends ObservationCorrection {
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

export type ObservationValidationError =
  | 'invalid_id'
  | 'invalid_user_id'
  | 'invalid_coding'
  | 'invalid_decimal'
  | 'invalid_timestamp'
  | 'invalid_temporal_order'
  | 'invalid_timezone'
  | 'invalid_source_id'
  | 'invalid_source_type'
  | 'invalid_provenance_id'
  | 'invalid_fact_class'
  | 'invalid_status'
  | 'invalid_version';

export type ProvenanceValidationError =
  | 'invalid_id'
  | 'invalid_user_id'
  | 'invalid_source_type'
  | 'invalid_source_id'
  | 'invalid_transformation_ref'
  | 'invalid_timestamp'
  | 'invalid_temporal_order';

export type ProvenanceResult =
  | { readonly ok: true; readonly value: ProvenanceRecord }
  | {
      readonly ok: false;
      readonly errors: readonly ProvenanceValidationError[];
    };

export type ObservationResult =
  | { readonly ok: true; readonly value: QuantitativeObservation }
  | {
      readonly ok: false;
      readonly errors: readonly ObservationValidationError[];
    };

const opaqueId = /^[a-z]{3}_[A-Za-z0-9_-]{16,64}$/;
const codingPart = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const decimal = /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,9})?$/;
const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function validCoding(coding: Coding): boolean {
  return codingPart.test(coding.system) && codingPart.test(coding.code);
}

function timestamp(value: string): number | null {
  if (!utcTimestamp.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

function offsetFor(timestampValue: string, timeZone: string): number | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(timestampValue))
      .find((part) => part.type === 'timeZoneName')?.value;
    if (name === 'GMT') return 0;
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name ?? '');
    if (!match) return null;
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] === '-' ? -minutes : minutes;
  } catch {
    return null;
  }
}

export function validateProvenanceRecord(
  candidate: ProvenanceRecord,
): ProvenanceResult {
  const errors = new Set<ProvenanceValidationError>();
  if (!/^prv_[A-Za-z0-9_-]{16,64}$/.test(candidate.id))
    errors.add('invalid_id');
  if (!/^usr_[A-Za-z0-9_-]{16,64}$/.test(candidate.userId))
    errors.add('invalid_user_id');
  if (!['manual', 'imported', 'derived'].includes(candidate.sourceType))
    errors.add('invalid_source_type');
  if (!opaqueId.test(candidate.sourceId)) errors.add('invalid_source_id');
  if (
    candidate.methodCode !== undefined &&
    candidate.methodCode !== null &&
    candidate.methodCode !== 'capillary_user_reported'
  )
    errors.add('invalid_source_id');
  if (
    (candidate.sourceType === 'derived' &&
      (!candidate.transformationRef ||
        candidate.transformationRef.length > 200)) ||
    (candidate.sourceType !== 'derived' && candidate.transformationRef !== null)
  )
    errors.add('invalid_transformation_ref');
  const recordedAt = timestamp(candidate.recordedAt);
  const createdAt = timestamp(candidate.createdAt);
  if (recordedAt === null || createdAt === null)
    errors.add('invalid_timestamp');
  else if (recordedAt > createdAt + 5 * 60 * 1000)
    errors.add('invalid_temporal_order');
  return errors.size === 0
    ? { ok: true, value: candidate }
    : { ok: false, errors: [...errors] };
}

export function validateQuantitativeObservation(
  candidate: QuantitativeObservation,
): ObservationResult {
  const errors = new Set<ObservationValidationError>();
  if (!/^obs_[A-Za-z0-9_-]{16,64}$/.test(candidate.id))
    errors.add('invalid_id');
  if (!/^usr_[A-Za-z0-9_-]{16,64}$/.test(candidate.userId))
    errors.add('invalid_user_id');
  if (!validCoding(candidate.type) || !validCoding(candidate.quantity.unit))
    errors.add('invalid_coding');
  if (!decimal.test(candidate.quantity.decimalValue))
    errors.add('invalid_decimal');

  const occurredAt = timestamp(candidate.occurredAt);
  const recordedAt = timestamp(candidate.recordedAt);
  const ingestedAt = timestamp(candidate.ingestedAt);
  const createdAt = timestamp(candidate.createdAt);
  if (
    occurredAt === null ||
    recordedAt === null ||
    ingestedAt === null ||
    createdAt === null
  ) {
    errors.add('invalid_timestamp');
  } else if (
    occurredAt > recordedAt ||
    recordedAt > ingestedAt ||
    ingestedAt > createdAt
  ) {
    errors.add('invalid_temporal_order');
  }
  if (
    !Number.isInteger(candidate.utcOffsetMinutes) ||
    offsetFor(candidate.occurredAt, candidate.observedTimezone) !==
      candidate.utcOffsetMinutes
  )
    errors.add('invalid_timezone');

  if (!opaqueId.test(candidate.sourceId)) errors.add('invalid_source_id');
  if (!['manual', 'imported', 'derived'].includes(candidate.sourceType))
    errors.add('invalid_source_type');
  if (!/^prv_[A-Za-z0-9_-]{16,64}$/.test(candidate.provenanceId))
    errors.add('invalid_provenance_id');
  if (
    !['fact', 'declaration', 'derivation', 'clinical_assertion'].includes(
      candidate.factClass,
    )
  )
    errors.add('invalid_fact_class');
  if (!['current', 'superseded', 'entered_in_error'].includes(candidate.status))
    errors.add('invalid_status');
  if (!Number.isSafeInteger(candidate.version) || candidate.version < 1)
    errors.add('invalid_version');

  return errors.size === 0
    ? { ok: true, value: candidate }
    : { ok: false, errors: [...errors] };
}
