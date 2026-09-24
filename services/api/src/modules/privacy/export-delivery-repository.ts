import type { Pool } from 'pg';
import type { ExportDeliveryRepository, PrivacyRequest } from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';

interface RequestRow {
  id: string;
  user_id: string;
  kind: PrivacyRequest['kind'];
  scope: PrivacyRequest['scope'];
  status: PrivacyRequest['status'];
  version: number;
  requested_at: Date;
  updated_at: Date;
}

const columns = 'id,user_id,kind,scope,status,version,requested_at,updated_at';

function map(row: RequestRow): PrivacyRequest {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    scope: row.scope,
    status: row.status,
    version: row.version,
    requestedAt: row.requested_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function createPostgresExportDeliveryRepository(
  pool: Pool,
): ExportDeliveryRepository {
  return {
    async recordGenerated(receipt) {
      await pool.query(
        `INSERT INTO privacy.export_delivery_receipts
          (id,request_id,user_id,sha256,record_count,status,generated_at)
         VALUES ($1,$2,$3,$4,$5,'generated',$6)`,
        [
          receipt.id,
          receipt.requestId,
          receipt.userId,
          receipt.sha256,
          receipt.recordCount,
          receipt.generatedAt,
        ],
      );
    },
    async acknowledgeAndFulfill(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const request = await client.query<RequestRow>(
          `SELECT ${columns} FROM privacy.requests
            WHERE id=$1 AND user_id=$2 FOR UPDATE`,
          [input.requestId, input.userId],
        );
        const current = request.rows[0];
        if (
          !current ||
          current.kind !== 'export' ||
          current.status !== 'in_review'
        )
          throw new Error('Export delivery conflict');
        const receipt = await client.query(
          `UPDATE privacy.export_delivery_receipts
              SET status='acknowledged',acknowledged_at=$5
            WHERE id=$1 AND request_id=$2 AND user_id=$3 AND sha256=$4
              AND status='generated'
          RETURNING id`,
          [
            input.deliveryId,
            input.requestId,
            input.userId,
            input.sha256,
            input.acknowledgedAt,
          ],
        );
        if (receipt.rowCount !== 1) throw new Error('Export delivery conflict');
        const updated = await client.query<RequestRow>(
          `UPDATE privacy.requests SET status='fulfilled',version=version+1,updated_at=$3
            WHERE id=$1 AND user_id=$2 RETURNING ${columns}`,
          [input.requestId, input.userId, input.acknowledgedAt],
        );
        await client.query(
          `INSERT INTO privacy.request_events
            (id,request_id,user_id,from_status,to_status,reason_code,occurred_at)
           VALUES ($1,$2,$3,'in_review','fulfilled','client_checksum_acknowledged',$4)`,
          [input.eventId, input.requestId, input.userId, input.acknowledgedAt],
        );
        await insertAuditEvent(client, {
          id: input.auditId,
          eventKey: 'privacy.export_delivered',
          actorType: 'consumer',
          actorId: input.userId,
          subjectId: input.userId,
          resourceType: 'privacy_request',
          resourceId: input.requestId,
          action: 'fulfilled',
          outcome: 'succeeded',
          requestId: input.auditRequestId,
          retentionPolicyRef: input.retentionPolicyRef,
          occurredAt: input.acknowledgedAt,
        });
        await client.query('COMMIT');
        return map(updated.rows[0]!);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
