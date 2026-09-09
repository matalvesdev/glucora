import type { Pool, PoolClient } from 'pg';
import type {
  AuditEvent,
  AuditRepository,
  RecordAuditEvent,
} from '@glucora/domain';

interface AuditEventRow {
  id: string;
  event_key: string;
  actor_type: AuditEvent['actorType'];
  actor_id: string | null;
  subject_id: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  outcome: AuditEvent['outcome'];
  request_id: string | null;
  retention_policy_ref: string;
  occurred_at: Date;
  recorded_at: Date;
}

function mapEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    eventKey: row.event_key,
    actorType: row.actor_type,
    actorId: row.actor_id,
    subjectId: row.subject_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    action: row.action,
    outcome: row.outcome,
    requestId: row.request_id,
    retentionPolicyRef: row.retention_policy_ref,
    occurredAt: row.occurred_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
  };
}

export async function insertAuditEvent(
  client: Pool | PoolClient,
  input: RecordAuditEvent,
): Promise<AuditEvent> {
  const result = await client.query<AuditEventRow>(
    `INSERT INTO audit.events
       (id, event_key, actor_type, actor_id, subject_id, resource_type,
        resource_id, action, outcome, request_id, retention_policy_ref, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, event_key, actor_type, actor_id, subject_id, resource_type,
               resource_id, action, outcome, request_id, retention_policy_ref,
               occurred_at, recorded_at`,
    [
      input.id,
      input.eventKey,
      input.actorType,
      input.actorId,
      input.subjectId,
      input.resourceType,
      input.resourceId,
      input.action,
      input.outcome,
      input.requestId,
      input.retentionPolicyRef,
      input.occurredAt,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Audit event was not recorded');
  return mapEvent(row);
}

export function createPostgresAuditRepository(pool: Pool): AuditRepository {
  return {
    async record(input: RecordAuditEvent): Promise<AuditEvent> {
      return insertAuditEvent(pool, input);
    },
    async historyForResource(resourceType, resourceId): Promise<AuditEvent[]> {
      const result = await pool.query<AuditEventRow>(
        `SELECT id, event_key, actor_type, actor_id, subject_id, resource_type,
                resource_id, action, outcome, request_id, retention_policy_ref,
                occurred_at, recorded_at
         FROM audit.events
         WHERE resource_type = $1 AND resource_id = $2
         ORDER BY occurred_at ASC, recorded_at ASC, id ASC`,
        [resourceType, resourceId],
      );
      return result.rows.map(mapEvent);
    },
  };
}
