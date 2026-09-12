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
        review_at: Date;
        expires_at: Date;
      }>(
        `INSERT INTO privacy.retention_hold_events (id,user_id,hold_ref,event_type,reason_code,responsible_ref,evidence_ref,occurred_at,review_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,user_id,hold_ref,event_type,reason_code,responsible_ref,evidence_ref,occurred_at,review_at,expires_at`,
        [
          event.id,
          event.userId,
          event.holdRef,
          event.eventType,
          event.reasonCode,
          event.responsibleRef,
          event.evidenceRef,
          event.occurredAt,
          event.reviewAt,
          event.expiresAt,
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
        reviewAt: row.review_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
      };
    },
    async listForHold(userId, holdRef) {
      const result = await pool.query<{
        id: string;
        user_id: string;
        hold_ref: string;
        event_type: RetentionHoldEvent['eventType'];
        reason_code: string;
        responsible_ref: string;
        evidence_ref: string;
        occurred_at: Date;
        review_at: Date;
        expires_at: Date;
      }>(
        `SELECT id,user_id,hold_ref,event_type,reason_code,responsible_ref,evidence_ref,occurred_at,review_at,expires_at
           FROM privacy.retention_hold_events
          WHERE user_id = $1 AND hold_ref = $2
          ORDER BY occurred_at ASC, id ASC`,
        [userId, holdRef],
      );
      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        holdRef: row.hold_ref,
        eventType: row.event_type,
        reasonCode: row.reason_code,
        responsibleRef: row.responsible_ref,
        evidenceRef: row.evidence_ref,
        occurredAt: row.occurred_at.toISOString(),
        reviewAt: row.review_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
      }));
    },
  };
}
