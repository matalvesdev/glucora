import { describe, expect, it } from 'vitest';
import {
  evaluateObservationCatalog,
  approvedManualGlucoseCatalog,
  approvedManualGlucoseType,
  approvedManualGlucoseUnit,
  validateProvenanceRecord,
  validateQuantitativeObservation,
  type QuantitativeObservation,
} from '../packages/domain/src/index';

const validProvenance = {
  id: 'prv_syntheticorigin001',
  userId: 'usr_syntheticconsumer001',
  sourceType: 'manual' as const,
  sourceId: 'src_syntheticmanual001',
  transformationRef: null,
  recordedAt: '2026-01-01T10:01:00.000Z',
  createdAt: '2026-01-01T10:02:00.000Z',
};

const valid: QuantitativeObservation = {
  id: 'obs_syntheticmeasure0001',
  userId: 'usr_syntheticconsumer001',
  type: { system: 'synthetic.test', code: 'measurement' },
  quantity: {
    decimalValue: '123.45',
    unit: { system: 'synthetic.units', code: 'unit' },
  },
  occurredAt: '2026-01-01T10:00:00.000Z',
  observedTimezone: 'America/Sao_Paulo',
  utcOffsetMinutes: -180,
  recordedAt: '2026-01-01T10:01:00.000Z',
  ingestedAt: '2026-01-01T10:02:00.000Z',
  sourceType: 'manual',
  sourceId: 'src_syntheticmanual001',
  provenanceId: 'prv_syntheticorigin001',
  factClass: 'declaration',
  status: 'current',
  version: 1,
  createdAt: '2026-01-01T10:02:00.000Z',
};

describe('quantitative observation domain', () => {
  it('accepts a complete, exact and provenance-linked observation', () => {
    expect(validateQuantitativeObservation(valid)).toEqual({
      ok: true,
      value: valid,
    });
  });

  it.each([
    ['opaque observation id', { id: '1' }, 'invalid_id'],
    ['owner id', { userId: 'another-user' }, 'invalid_user_id'],
    [
      'type coding',
      { type: { system: '', code: 'measurement' } },
      'invalid_coding',
    ],
    [
      'explicit unit',
      { quantity: { ...valid.quantity, unit: { system: '', code: '' } } },
      'invalid_coding',
    ],
    [
      'exact decimal representation',
      { quantity: { ...valid.quantity, decimalValue: 'NaN' } },
      'invalid_decimal',
    ],
    [
      'UTC timestamp',
      { occurredAt: '2026-01-01T10:00:00-03:00' },
      'invalid_timestamp',
    ],
    [
      'real calendar timestamp',
      { occurredAt: '2026-02-31T10:00:00.000Z' },
      'invalid_timestamp',
    ],
    [
      'temporal order',
      { recordedAt: '2026-01-01T09:59:00.000Z' },
      'invalid_temporal_order',
    ],
    ['timezone offset', { utcOffsetMinutes: 0 }, 'invalid_timezone'],
    ['IANA timezone', { observedTimezone: 'unknown' }, 'invalid_timezone'],
    ['source reference', { sourceId: 'manual' }, 'invalid_source_id'],
    [
      'source type',
      { sourceType: 'unknown' as QuantitativeObservation['sourceType'] },
      'invalid_source_type',
    ],
    ['provenance reference', { provenanceId: '' }, 'invalid_provenance_id'],
    [
      'inference as measurement',
      { factClass: 'inference' },
      'invalid_fact_class',
    ],
    [
      'unknown status',
      { status: 'unknown' as QuantitativeObservation['status'] },
      'invalid_status',
    ],
    ['positive version', { version: 0 }, 'invalid_version'],
  ])('rejects an invalid %s', (_name, override, error) => {
    const result = validateQuantitativeObservation({
      ...valid,
      ...override,
    } as QuantitativeObservation);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain(error);
  });

  it('does not convert, round or clinically interpret the supplied value', () => {
    const candidate = {
      ...valid,
      quantity: { ...valid.quantity, decimalValue: '000.10' },
    };
    expect(validateQuantitativeObservation(candidate)).toEqual({
      ok: false,
      errors: ['invalid_decimal'],
    });
  });

  it('denies combinations absent from the injected type and unit catalog', () => {
    expect(
      evaluateObservationCatalog(valid, { supports: () => false }),
    ).toEqual({ allowed: false, reason: 'unsupported_type_or_unit' });
    expect(
      evaluateObservationCatalog(valid, {
        supports: (type, unit) =>
          type.code === 'measurement' && unit.code === 'unit',
      }),
    ).toEqual({ allowed: true });
  });

  it('allows only the approved initial manual glucose pair', () => {
    const approved = {
      ...valid,
      type: approvedManualGlucoseType,
      quantity: { decimalValue: '101.25', unit: approvedManualGlucoseUnit },
    };
    expect(
      evaluateObservationCatalog(approved, approvedManualGlucoseCatalog),
    ).toEqual({ allowed: true });
    expect(
      evaluateObservationCatalog(
        {
          ...approved,
          quantity: {
            ...approved.quantity,
            unit: { ...approved.quantity.unit, code: 'mmol/L' },
          },
        },
        approvedManualGlucoseCatalog,
      ),
    ).toEqual({ allowed: false, reason: 'unsupported_type_or_unit' });
  });

  it('validates provenance structure and derived transformation evidence', () => {
    expect(validateProvenanceRecord(validProvenance)).toEqual({
      ok: true,
      value: validProvenance,
    });
    expect(
      validateProvenanceRecord({
        ...validProvenance,
        sourceType: 'derived',
        transformationRef: null,
      }),
    ).toEqual({ ok: false, errors: ['invalid_transformation_ref'] });
    expect(
      validateProvenanceRecord({
        ...validProvenance,
        recordedAt: '2026-01-01T10:08:00.001Z',
      }),
    ).toEqual({ ok: false, errors: ['invalid_temporal_order'] });
  });
});
