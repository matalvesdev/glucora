import type { Pool } from 'pg';
import type {
  ConsentEvent,
  ConsentHistoryItem,
  ConsentRepository,
  RecordConsentDecision,
} from '@glucora/domain';

interface ConsentEventRow {
  id: string;
  user_id: string;
  purpose_version_id: string;
  event_type: ConsentEvent['decision'];
  channel: string;
  idempotency_key: string;
  occurred_at: Date;
  recorded_at: Date;
}
interface ConsentHistoryRow extends ConsentEventRow {
  purpose_key: string;
  purpose_version: number;
  purpose_title: string;
  notice_text: string;
}

function mapEvent(row: ConsentEventRow): ConsentEvent {
  return {
    id: row.id,
    userId: row.user_id,
    purposeVersionId: row.purpose_version_id,
    decision: row.event_type,
    channel: row.channel,
    idempotencyKey: row.idempotency_key,
    occurredAt: row.occurred_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
  };
}

function mapHistory(row: ConsentHistoryRow): ConsentHistoryItem {
  return {
    eventId: row.id,
    purposeVersionId: row.purpose_version_id,
    purposeKey: row.purpose_key,
    purposeVersion: row.purpose_version,
    purposeTitle: row.purpose_title,
    noticeText: row.notice_text,
    decision: row.event_type,
    occurredAt: row.occurred_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
  };
}

export function createPostgresConsentRepository(pool: Pool): ConsentRepository {
  return {
    async record(input: RecordConsentDecision): Promise<ConsentEvent> {
      const result = await pool.query<ConsentEventRow>(
        `WITH inserted AS (
           INSERT INTO consent.events
           (id, user_id, purpose_version_id, event_type, channel, idempotency_key, occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, purpose_version_id, idempotency_key) DO NOTHING
           RETURNING id, user_id, purpose_version_id, event_type, channel,
                     idempotency_key, occurred_at, recorded_at
         )
         SELECT * FROM inserted
         UNION ALL
         SELECT id, user_id, purpose_version_id, event_type, channel,
                idempotency_key, occurred_at, recorded_at
         FROM consent.events
         WHERE user_id = $2 AND purpose_version_id = $3 AND idempotency_key = $6
         LIMIT 1`,
        [
          input.id,
          input.userId,
          input.purposeVersionId,
          input.decision,
          input.channel,
          input.idempotencyKey,
          input.occurredAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Consent event was not recorded');
      const event = mapEvent(row);
      if (
        event.id !== input.id ||
        event.decision !== input.decision ||
        event.channel !== input.channel ||
        event.occurredAt !== new Date(input.occurredAt).toISOString()
      ) {
        throw new Error('Idempotency key reused with different consent data');
      }
      return event;
    },
    async history(userId, purposeVersionId): Promise<ConsentEvent[]> {
      const result = await pool.query<ConsentEventRow>(
        `SELECT id, user_id, purpose_version_id, event_type, channel,
                idempotency_key, occurred_at, recorded_at
         FROM consent.events
         WHERE user_id = $1 AND purpose_version_id = $2
         ORDER BY occurred_at ASC, recorded_at ASC, id ASC`,
        [userId, purposeVersionId],
      );
      return result.rows.map(mapEvent);
    },
    async current(userId, purposeVersionId): Promise<ConsentEvent | null> {
      const result = await pool.query<ConsentEventRow>(
        `SELECT id, user_id, purpose_version_id, event_type, channel,
                idempotency_key, occurred_at, recorded_at
         FROM consent.events
         WHERE user_id = $1 AND purpose_version_id = $2
         ORDER BY occurred_at DESC, recorded_at DESC, id DESC
         LIMIT 1`,
        [userId, purposeVersionId],
      );
      const row = result.rows[0];
      return row ? mapEvent(row) : null;
    },
    async listHistory(userId, page) {
      if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 101)
        throw new Error('Invalid consent history limit');
      if (
        page.before &&
        (!Number.isFinite(Date.parse(page.before.occurredAt)) ||
          !/^cne_[A-Za-z0-9_-]{16,64}$/.test(page.before.eventId))
      )
        throw new Error('Invalid consent history cursor');
      const result = await pool.query<ConsentHistoryRow>(
        `SELECT e.id,e.user_id,e.purpose_version_id,e.event_type,e.channel,
                e.idempotency_key,e.occurred_at,e.recorded_at,
                p.purpose_key,p.version AS purpose_version,
                p.title AS purpose_title,p.notice_text
         FROM consent.events e
         JOIN consent.purpose_versions p ON p.id=e.purpose_version_id
         WHERE e.user_id=$1
           AND ($2::timestamptz IS NULL OR (e.occurred_at,e.id) < ($2::timestamptz,$3))
         ORDER BY e.occurred_at DESC,e.id DESC LIMIT $4`,
        [
          userId,
          page.before?.occurredAt ?? null,
          page.before?.eventId ?? null,
          page.limit,
        ],
      );
      return result.rows.map(mapHistory);
    },
  };
}
