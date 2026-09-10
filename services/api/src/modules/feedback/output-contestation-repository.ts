import type { Pool } from 'pg';
import type {
  OutputContestation,
  OutputContestationRepository,
} from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';
interface Row {
  id: string;
  user_id: string;
  resource_type: OutputContestation['resourceType'];
  resource_id: string;
  resource_version: string;
  reason: OutputContestation['reason'];
  status: 'open';
  occurred_at: Date;
}
const columns =
  'id,user_id,resource_type,resource_id,resource_version,reason,status,occurred_at';
const map = (row: Row): OutputContestation => ({
  id: row.id,
  userId: row.user_id,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  resourceVersion: row.resource_version,
  reason: row.reason,
  status: row.status,
  occurredAt: row.occurred_at.toISOString(),
});
export function createPostgresOutputContestationRepository(
  pool: Pool,
): OutputContestationRepository {
  return {
    async record(value, audit) {
      if (audit.occurredAt !== value.occurredAt || value.status !== 'open')
        throw new Error('Invalid output contestation');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (value.resourceType === 'consultation_report') {
          const owned = await client.query(
            'SELECT 1 FROM consultation.reports WHERE id=$1 AND user_id=$2',
            [value.resourceId, value.userId],
          );
          if (owned.rowCount !== 1)
            throw new Error('Contested resource not owned');
        }
        const result = await client.query<Row>(
          `INSERT INTO privacy.output_contestations (${columns}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${columns}`,
          [
            value.id,
            value.userId,
            value.resourceType,
            value.resourceId,
            value.resourceVersion,
            value.reason,
            value.status,
            value.occurredAt,
          ],
        );
        await insertAuditEvent(client, {
          id: audit.id,
          eventKey: 'feedback.output_contested',
          actorType: 'consumer',
          actorId: value.userId,
          subjectId: value.userId,
          resourceType: 'output_contestation',
          resourceId: value.id,
          action: 'contested',
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
    async listOpen(userId, resourceType, resourceIds) {
      if (resourceIds.length === 0) return [];
      if (resourceIds.length > 100)
        throw new Error('Too many contested resource ids');
      const result = await pool.query<Row>(
        `SELECT ${columns} FROM privacy.output_contestations WHERE user_id=$1 AND resource_type=$2 AND resource_id=ANY($3::text[]) AND status='open' ORDER BY occurred_at,id`,
        [userId, resourceType, resourceIds],
      );
      return result.rows.map(map);
    },
  };
}
