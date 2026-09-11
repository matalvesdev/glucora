import type { Pool } from 'pg';
import type {
  ConsentDecisionRecorder,
  ConsentEvent,
  ConsentHistoryItem,
  ConsentPurposeRepository,
  ConsentPurposeVersion,
  PublishedConsentPurpose,
  ConsentRepository,
  RecordConsentDecisionWithAudit,
  RecordConsentDecision,
} from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';

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
interface ConsentPurposeRow {
  id: string;
  purpose_key: string;
  version: number;
  status: ConsentPurposeVersion['status'];
  title: string;
  notice_text: string;
  legal_basis_ref: string;
  retention_policy_ref: string;
  effective_from: Date | null;
  retired_at: Date | null;
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

function mapPurpose(row: ConsentPurposeRow): PublishedConsentPurpose {
  return {
    id: row.id,
    purposeKey: row.purpose_key,
    version: row.version,
    status: row.status,
    title: row.title,
    noticeText: row.notice_text,
    legalBasisRef: row.legal_basis_ref,
    retentionPolicyRef: row.retention_policy_ref,
    effectiveFrom: row.effective_from?.toISOString() ?? null,
    retiredAt: row.retired_at?.toISOString() ?? null,
  };
}

async function recordEvent(
  client: Pool | import('pg').PoolClient,
  input: RecordConsentDecision,
): Promise<ConsentEvent> {
  const result = await client.query<ConsentEventRow>(
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
    event.decision !== input.decision ||
    event.channel !== input.channel ||
    (event.id === input.id &&
      event.occurredAt !== new Date(input.occurredAt).toISOString())
  )
    throw new Error('Idempotency key reused with different consent data');
  return event;
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
      return recordEvent(pool, input);
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

export function createPostgresConsentPurposeRepository(
  pool: Pool,
): ConsentPurposeRepository {
  return {
    async listPublished(evaluatedAt) {
      const result = await pool.query<ConsentPurposeRow>(
        `SELECT id,purpose_key,version,status,title,notice_text,legal_basis_ref,
                retention_policy_ref,effective_from,retired_at
         FROM consent.purpose_versions
         WHERE status='published' AND effective_from <= $1
           AND (retired_at IS NULL OR retired_at > $1)
         ORDER BY purpose_key ASC,version DESC`,
        [evaluatedAt],
      );
      return result.rows.map(mapPurpose);
    },
  };
}

export function createPostgresConsentDecisionRecorder(
  pool: Pool,
): ConsentDecisionRecorder {
  return {
    async recordWithAudit(input: RecordConsentDecisionWithAudit) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const event = await recordEvent(client, input);
        if (event.id === input.id) {
          await insertAuditEvent(client, {
            id: input.audit.id,
            eventKey: 'consent.decision_recorded',
            actorType: 'consumer',
            actorId: input.userId,
            subjectId: input.userId,
            resourceType: 'consent_event',
            resourceId: event.id,
            action: input.decision,
            outcome: 'succeeded',
            requestId: input.audit.requestId,
            retentionPolicyRef: input.audit.retentionPolicyRef,
            occurredAt: input.audit.occurredAt,
          });
        }
        await client.query('COMMIT');
        return event;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
