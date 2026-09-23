import type { Pool, PoolClient } from 'pg';
import {
  validateQuantitativeObservation,
  validateProvenanceRecord,
  type ManualObservationCapture,
  type ManualObservationCorrection,
  type ObservationRepository,
  type ProvenanceRecord,
  type QuantitativeObservation,
} from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';

interface ObservationRow {
  id: string;
  version: number;
  user_id: string;
  type_system: string;
  type_code: string;
  decimal_value: string;
  unit_system: string;
  unit_code: string;
  occurred_at: Date;
  observed_timezone: string;
  utc_offset_minutes: number;
  recorded_at: Date;
  ingested_at: Date;
  source_type: QuantitativeObservation['sourceType'];
  source_id: string;
  provenance_id: string;
  fact_class: QuantitativeObservation['factClass'];
  status: QuantitativeObservation['status'];
  created_at: Date;
}

const columns = `id, version, user_id, type_system, type_code, decimal_value::text,
  unit_system, unit_code, occurred_at, observed_timezone, utc_offset_minutes,
  recorded_at, ingested_at, source_type,
  source_id, provenance_id, fact_class, status, created_at`;

function map(row: ObservationRow): QuantitativeObservation {
  return {
    id: row.id,
    version: row.version,
    userId: row.user_id,
    type: { system: row.type_system, code: row.type_code },
    quantity: {
      decimalValue: row.decimal_value,
      unit: { system: row.unit_system, code: row.unit_code },
    },
    occurredAt: row.occurred_at.toISOString(),
    observedTimezone: row.observed_timezone,
    utcOffsetMinutes: row.utc_offset_minutes,
    recordedAt: row.recorded_at.toISOString(),
    ingestedAt: row.ingested_at.toISOString(),
    sourceType: row.source_type,
    sourceId: row.source_id,
    provenanceId: row.provenance_id,
    factClass: row.fact_class,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

async function insertProvenance(client: PoolClient, value: ProvenanceRecord) {
  await client.query(
    `INSERT INTO health.provenance_records
      (id, user_id, source_type, source_id, method_code, transformation_ref, recorded_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      value.id,
      value.userId,
      value.sourceType,
      value.sourceId,
      value.methodCode,
      value.transformationRef,
      value.recordedAt,
      value.createdAt,
    ],
  );
}

async function recordManualCapture(
  pool: Pool,
  input: ManualObservationCapture,
): Promise<QuantitativeObservation> {
  const validation = validateQuantitativeObservation(input.observation);
  const provenanceValidation = validateProvenanceRecord(input.provenance);
  if (!validation.ok || !provenanceValidation.ok)
    throw new Error('Invalid observation');
  if (
    input.observation.version !== 1 ||
    input.observation.status !== 'current' ||
    input.observation.sourceType !== 'manual' ||
    input.provenance.methodCode !== 'capillary_user_reported' ||
    input.provenance.id !== input.observation.provenanceId ||
    input.provenance.userId !== input.observation.userId ||
    input.provenance.sourceType !== input.observation.sourceType ||
    input.provenance.sourceId !== input.observation.sourceId ||
    input.provenance.recordedAt !== input.observation.recordedAt
  )
    throw new Error('Invalid manual observation capture');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${input.observation.userId}:${input.idempotencyKey}`,
    ]);
    const previous = await client.query<{
      request_hash: string;
      observation_id: string;
      observation_version: number;
    }>(
      `SELECT request_hash, observation_id, observation_version
       FROM health.manual_observation_captures
       WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [input.observation.userId, input.idempotencyKey],
    );
    if (previous.rowCount) {
      const capture = previous.rows[0]!;
      if (capture.request_hash !== input.requestHash)
        throw new Error('Idempotency key reused');
      const result = await client.query<ObservationRow>(
        `SELECT ${columns} FROM health.observations
         WHERE id=$1 AND version=$2 AND user_id=$3`,
        [
          capture.observation_id,
          capture.observation_version,
          input.observation.userId,
        ],
      );
      if (!result.rows[0]) throw new Error('Manual capture record missing');
      await client.query('COMMIT');
      return map(result.rows[0]);
    }
    await insertProvenance(client, input.provenance);
    const result = await client.query<ObservationRow>(
      `INSERT INTO health.observations
        (id, version, user_id, type_system, type_code, decimal_value, unit_system,
         unit_code, occurred_at, observed_timezone, utc_offset_minutes,
         recorded_at, ingested_at, source_type, source_id,
         provenance_id, fact_class, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING ${columns}`,
      [
        input.observation.id,
        input.observation.version,
        input.observation.userId,
        input.observation.type.system,
        input.observation.type.code,
        input.observation.quantity.decimalValue,
        input.observation.quantity.unit.system,
        input.observation.quantity.unit.code,
        input.observation.occurredAt,
        input.observation.observedTimezone,
        input.observation.utcOffsetMinutes,
        input.observation.recordedAt,
        input.observation.ingestedAt,
        input.observation.sourceType,
        input.observation.sourceId,
        input.observation.provenanceId,
        input.observation.factClass,
        input.observation.status,
        input.observation.createdAt,
      ],
    );
    await insertAuditEvent(client, {
      id: input.audit.id,
      eventKey: 'observation.manual_capture_recorded',
      actorType: 'consumer',
      actorId: input.observation.userId,
      subjectId: input.observation.userId,
      resourceType: 'observation',
      resourceId: input.observation.id,
      action: 'created',
      outcome: 'succeeded',
      requestId: input.audit.requestId,
      retentionPolicyRef: input.audit.retentionPolicyRef,
      occurredAt: input.audit.occurredAt,
    });
    await client.query(
      `INSERT INTO health.manual_observation_captures
       (user_id,idempotency_key,request_hash,observation_id,observation_version,created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.observation.userId,
        input.idempotencyKey,
        input.requestHash,
        input.observation.id,
        input.observation.version,
        input.observation.createdAt,
      ],
    );
    await client.query('COMMIT');
    return map(result.rows[0]!);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function correctManualCapture(
  pool: Pool,
  input: ManualObservationCorrection,
): Promise<QuantitativeObservation> {
  const { replacement, provenance, audit } = input;
  const valid = validateQuantitativeObservation(replacement);
  const provenanceValid = validateProvenanceRecord(provenance);
  if (!valid.ok || !provenanceValid.ok || replacement.status !== 'current')
    throw new Error('Invalid replacement observation');
  if (
    replacement.sourceType !== 'manual' ||
    provenance.methodCode !== 'capillary_user_reported' ||
    provenance.id !== replacement.provenanceId ||
    provenance.userId !== replacement.userId ||
    provenance.sourceId !== replacement.sourceId ||
    provenance.recordedAt !== replacement.recordedAt ||
    audit.occurredAt !== replacement.createdAt
  )
    throw new Error('Invalid manual observation correction');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${replacement.userId}:${input.idempotencyKey}`,
    ]);
    const prior = await client.query<{
      request_hash: string;
      observation_id: string;
      observation_version: number;
    }>(
      `SELECT request_hash, observation_id, observation_version FROM health.manual_observation_corrections WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [replacement.userId, input.idempotencyKey],
    );
    if (prior.rowCount) {
      const evidence = prior.rows[0]!;
      if (evidence.request_hash !== input.requestHash)
        throw new Error('Idempotency key reused');
      const result = await client.query<ObservationRow>(
        `SELECT ${columns} FROM health.observations WHERE id=$1 AND version=$2 AND user_id=$3`,
        [
          evidence.observation_id,
          evidence.observation_version,
          replacement.userId,
        ],
      );
      if (!result.rows[0]) throw new Error('Manual correction record missing');
      await client.query('COMMIT');
      return map(result.rows[0]);
    }
    const current = await client.query<ObservationRow>(
      `SELECT ${columns} FROM health.observations WHERE id=$1 AND user_id=$2 AND status='current' FOR UPDATE`,
      [replacement.id, replacement.userId],
    );
    const previous = current.rows[0];
    if (!previous || replacement.version !== previous.version + 1)
      throw new Error('Observation correction conflict');
    await client.query(
      `UPDATE health.observations SET status='superseded', superseded_at=$3 WHERE id=$1 AND version=$2`,
      [replacement.id, previous.version, replacement.createdAt],
    );
    await insertProvenance(client, provenance);
    const result = await client.query<ObservationRow>(
      `INSERT INTO health.observations (id,version,user_id,type_system,type_code,decimal_value,unit_system,unit_code,occurred_at,observed_timezone,utc_offset_minutes,recorded_at,ingested_at,source_type,source_id,provenance_id,fact_class,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING ${columns}`,
      [
        replacement.id,
        replacement.version,
        replacement.userId,
        replacement.type.system,
        replacement.type.code,
        replacement.quantity.decimalValue,
        replacement.quantity.unit.system,
        replacement.quantity.unit.code,
        replacement.occurredAt,
        replacement.observedTimezone,
        replacement.utcOffsetMinutes,
        replacement.recordedAt,
        replacement.ingestedAt,
        replacement.sourceType,
        replacement.sourceId,
        replacement.provenanceId,
        replacement.factClass,
        replacement.status,
        replacement.createdAt,
      ],
    );
    await insertAuditEvent(client, {
      id: audit.id,
      eventKey: 'observation.manual_corrected',
      actorType: 'consumer',
      actorId: replacement.userId,
      subjectId: replacement.userId,
      resourceType: 'observation',
      resourceId: replacement.id,
      action: 'corrected',
      outcome: 'succeeded',
      requestId: audit.requestId,
      retentionPolicyRef: audit.retentionPolicyRef,
      occurredAt: audit.occurredAt,
    });
    await client.query(
      `INSERT INTO health.manual_observation_corrections (user_id,idempotency_key,request_hash,observation_id,observation_version,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        replacement.userId,
        input.idempotencyKey,
        input.requestHash,
        replacement.id,
        replacement.version,
        replacement.createdAt,
      ],
    );
    await client.query('COMMIT');
    return map(result.rows[0]!);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgresObservationRepository(
  pool: Pool,
): ObservationRepository {
  return {
    recordManualCapture: (input) => recordManualCapture(pool, input),
    correctManualCapture: (input) => correctManualCapture(pool, input),
    async recordInitial(observation, provenance) {
      const validation = validateQuantitativeObservation(observation);
      const provenanceValidation = validateProvenanceRecord(provenance);
      if (!validation.ok || !provenanceValidation.ok)
        throw new Error('Invalid observation');
      if (observation.version !== 1 || observation.status !== 'current')
        throw new Error('Initial observation must be current version 1');
      if (
        provenance.id !== observation.provenanceId ||
        provenance.userId !== observation.userId ||
        provenance.sourceType !== observation.sourceType ||
        provenance.sourceId !== observation.sourceId ||
        provenance.recordedAt !== observation.recordedAt
      )
        throw new Error('Observation provenance does not match');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await insertProvenance(client, provenance);
        const result = await client.query<ObservationRow>(
          `INSERT INTO health.observations
            (id, version, user_id, type_system, type_code, decimal_value, unit_system,
             unit_code, occurred_at, observed_timezone, utc_offset_minutes,
             recorded_at, ingested_at, source_type, source_id,
             provenance_id, fact_class, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           RETURNING ${columns}`,
          [
            observation.id,
            observation.version,
            observation.userId,
            observation.type.system,
            observation.type.code,
            observation.quantity.decimalValue,
            observation.quantity.unit.system,
            observation.quantity.unit.code,
            observation.occurredAt,
            observation.observedTimezone,
            observation.utcOffsetMinutes,
            observation.recordedAt,
            observation.ingestedAt,
            observation.sourceType,
            observation.sourceId,
            observation.provenanceId,
            observation.factClass,
            observation.status,
            observation.createdAt,
          ],
        );
        await client.query('COMMIT');
        return map(result.rows[0]!);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async findCurrent(id, userId) {
      const result = await pool.query<ObservationRow>(
        `SELECT ${columns} FROM health.observations
         WHERE id = $1 AND user_id = $2 AND status = 'current'`,
        [id, userId],
      );
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async listCurrent(userId, query) {
      if (
        !Number.isInteger(query.limit) ||
        query.limit < 1 ||
        query.limit > 100
      )
        throw new Error('Invalid observation page limit');
      const values: unknown[] = [userId, query.limit];
      let cursor = '';
      let catalog = '';
      if ((query.type === undefined) !== (query.unit === undefined))
        throw new Error('Invalid observation catalog filter');
      if (query.type && query.unit) {
        values.push(
          query.type.system,
          query.type.code,
          query.unit.system,
          query.unit.code,
        );
        catalog =
          'AND type_system=$3 AND type_code=$4 AND unit_system=$5 AND unit_code=$6';
      }
      if (query.before) {
        values.push(query.before.occurredAt, query.before.id);
        const offset = query.type ? 7 : 3;
        cursor = `AND (occurred_at, id) < ($${offset}::timestamptz, $${offset + 1}::text)`;
      }
      const result = await pool.query<ObservationRow>(
        `SELECT ${columns} FROM health.observations
         WHERE user_id = $1 AND status = 'current' ${catalog} ${cursor}
         ORDER BY occurred_at DESC, id DESC LIMIT $2`,
        values,
      );
      return result.rows.map(map);
    },
    async correct({ replacement, provenance, audit }) {
      const validation = validateQuantitativeObservation(replacement);
      const provenanceValidation = validateProvenanceRecord(provenance);
      if (
        !validation.ok ||
        !provenanceValidation.ok ||
        replacement.status !== 'current'
      )
        throw new Error('Invalid replacement observation');
      if (
        provenance.id !== replacement.provenanceId ||
        provenance.userId !== replacement.userId ||
        provenance.sourceType !== replacement.sourceType ||
        provenance.sourceId !== replacement.sourceId ||
        provenance.recordedAt !== replacement.recordedAt ||
        audit.occurredAt !== replacement.createdAt
      )
        throw new Error('Correction evidence does not match');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query<ObservationRow>(
          `SELECT ${columns} FROM health.observations
           WHERE id = $1 AND user_id = $2 AND status = 'current' FOR UPDATE`,
          [replacement.id, replacement.userId],
        );
        const previous = current.rows[0];
        if (!previous || replacement.version !== previous.version + 1)
          throw new Error('Observation correction conflict');
        await client.query(
          `UPDATE health.observations
           SET status = 'superseded', superseded_at = $3
           WHERE id = $1 AND version = $2`,
          [replacement.id, previous.version, replacement.createdAt],
        );
        await insertProvenance(client, provenance);
        const result = await client.query<ObservationRow>(
          `INSERT INTO health.observations
            (id, version, user_id, type_system, type_code, decimal_value, unit_system,
             unit_code, occurred_at, observed_timezone, utc_offset_minutes,
             recorded_at, ingested_at, source_type, source_id,
             provenance_id, fact_class, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           RETURNING ${columns}`,
          [
            replacement.id,
            replacement.version,
            replacement.userId,
            replacement.type.system,
            replacement.type.code,
            replacement.quantity.decimalValue,
            replacement.quantity.unit.system,
            replacement.quantity.unit.code,
            replacement.occurredAt,
            replacement.observedTimezone,
            replacement.utcOffsetMinutes,
            replacement.recordedAt,
            replacement.ingestedAt,
            replacement.sourceType,
            replacement.sourceId,
            replacement.provenanceId,
            replacement.factClass,
            replacement.status,
            replacement.createdAt,
          ],
        );
        await insertAuditEvent(client, {
          id: audit.id,
          eventKey: 'observation.corrected',
          actorType: 'consumer',
          actorId: replacement.userId,
          subjectId: replacement.userId,
          resourceType: 'observation',
          resourceId: replacement.id,
          action: 'corrected',
          outcome: 'succeeded',
          requestId: audit.requestId,
          retentionPolicyRef: audit.retentionPolicyRef,
          occurredAt: audit.occurredAt,
        });
        await client.query('COMMIT');
        return map(result.rows[0]!);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
