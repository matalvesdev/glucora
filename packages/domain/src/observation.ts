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

export type ObservationValidationError =
  | 'invalid_id'
  | 'invalid_user_id'
  | 'invalid_coding'
  | 'invalid_decimal'
  | 'invalid_timestamp'
  | 'invalid_temporal_order'
  | 'invalid_source_id'
  | 'invalid_source_type'
  | 'invalid_provenance_id'
  | 'invalid_fact_class'
  | 'invalid_status'
  | 'invalid_version';

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
