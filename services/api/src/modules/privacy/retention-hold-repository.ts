import type {
  RetentionHoldEvent,
  RetentionHoldRepository,
} from '@glucora/domain';
import type { Pool } from 'pg';
export function createPostgresRetentionHoldRepository(
  pool: Pool,
): RetentionHoldRepository {
  return {
    async record(event) {
      const result = await pool.query<{
        id: string;
        user_id: string;
        hold_ref: string;
        event_type: RetentionHoldEvent['eventType'];
        reason_code: string;
        responsible_ref: string;
        evidence_ref: string;
        occurred_at: Date;
      }>(
        `INSERT INTO privacy.retention_hold_events (id,user_id,hold_ref,event_type,reason_code,responsible_ref,evidence_ref,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,user_id,hold_ref,event_type,reason_code,responsible_ref,evidence_ref,occurred_at`,
        [
          event.id,
          event.userId,
          event.holdRef,
          event.eventType,
          event.reasonCode,
          event.responsibleRef,
          event.evidenceRef,
          event.occurredAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Retention hold event was not recorded');
      return {
        id: row.id,
        userId: row.user_id,
        holdRef: row.hold_ref,
        eventType: row.event_type,
        reasonCode: row.reason_code,
        responsibleRef: row.responsible_ref,
        evidenceRef: row.evidence_ref,
        occurredAt: row.occurred_at.toISOString(),
      };
    },
  };
}
