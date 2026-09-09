import type { Pool, PoolClient } from 'pg';
import {
  validateQuantitativeObservation,
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
  unit_system, unit_code, occurred_at, recorded_at, ingested_at, source_type,
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
      (id, user_id, source_type, source_id, transformation_ref, recorded_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      value.id,
      value.userId,
      value.sourceType,
      value.sourceId,
      value.transformationRef,
      value.recordedAt,
      value.createdAt,
    ],
  );
}

export function createPostgresObservationRepository(
  pool: Pool,
): ObservationRepository {
  return {
    async recordInitial(observation, provenance) {
      const validation = validateQuantitativeObservation(observation);
      if (!validation.ok) throw new Error('Invalid observation');
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
             unit_code, occurred_at, recorded_at, ingested_at, source_type, source_id,
             provenance_id, fact_class, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
    async correct({ replacement, provenance, audit }) {
      const validation = validateQuantitativeObservation(replacement);
      if (!validation.ok || replacement.status !== 'current')
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
             unit_code, occurred_at, recorded_at, ingested_at, source_type, source_id,
             provenance_id, fact_class, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
