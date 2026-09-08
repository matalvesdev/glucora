import type { Pool } from 'pg';
import type {
  ConsentEvent,
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
  };
}
