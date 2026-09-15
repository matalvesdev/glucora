import type { Pool, PoolClient } from 'pg';
import {
  canTransitionPrivacyRequest,
  type PrivacyRequest,
  type PrivacyRequestEvent,
  type PrivacyRequestRepository,
} from '@glucora/domain';
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
  request_hash: string;
}
interface EventRow {
  id: string;
  request_id: string;
  user_id: string;
  from_status: PrivacyRequestEvent['fromStatus'];
  to_status: PrivacyRequestEvent['toStatus'];
  reason_code: string;
  occurred_at: Date;
}
const requestColumns =
  'id,user_id,kind,scope,status,version,requested_at,updated_at,request_hash';
const mapRequest = (row: RequestRow): PrivacyRequest => ({
  id: row.id,
  userId: row.user_id,
  kind: row.kind,
  scope: row.scope,
  status: row.status,
  version: row.version,
  requestedAt: row.requested_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
const mapEvent = (row: EventRow): PrivacyRequestEvent => ({
  id: row.id,
  requestId: row.request_id,
  userId: row.user_id,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  reasonCode: row.reason_code,
  occurredAt: row.occurred_at.toISOString(),
});
async function insertEvent(client: PoolClient, event: PrivacyRequestEvent) {
  await client.query(
    `INSERT INTO privacy.request_events (id,request_id,user_id,from_status,to_status,reason_code,occurred_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      event.id,
      event.requestId,
      event.userId,
      event.fromStatus,
      event.toStatus,
      event.reasonCode,
      event.occurredAt,
    ],
  );
}

export function createPostgresPrivacyRequestRepository(
  pool: Pool,
): PrivacyRequestRepository {
  return {
    async create(input) {
      const value = input.request;
      if (
        value.status !== 'requested' ||
        value.version !== 1 ||
        input.event.fromStatus !== null ||
        input.event.toStatus !== 'requested' ||
        input.event.requestId !== value.id ||
        input.event.userId !== value.userId ||
        input.event.occurredAt !== value.requestedAt ||
        value.updatedAt !== value.requestedAt ||
        !/^[a-f0-9]{64}$/.test(input.requestHash)
      )
        throw new Error('Invalid privacy request');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query<RequestRow>(
          `SELECT ${requestColumns} FROM privacy.requests WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE`,
          [value.userId, input.idempotencyKey],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].request_hash !== input.requestHash)
            throw new Error('Idempotency key reused');
          await client.query('COMMIT');
          return mapRequest(existing.rows[0]);
        }
        const inserted = await client.query<RequestRow>(
          `INSERT INTO privacy.requests
          (id,user_id,kind,scope,status,version,requested_at,updated_at,idempotency_key,request_hash)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${requestColumns}`,
          [
            value.id,
            value.userId,
            value.kind,
            value.scope,
            value.status,
            value.version,
            value.requestedAt,
            value.updatedAt,
            input.idempotencyKey,
            input.requestHash,
          ],
        );
        await insertEvent(client, input.event);
        await insertAuditEvent(client, {
          id: input.audit.id,
          eventKey: 'privacy.request_created',
          actorType: 'consumer',
          actorId: value.userId,
          subjectId: value.userId,
          resourceType: 'privacy_request',
          resourceId: value.id,
          action: 'created',
          outcome: 'succeeded',
          requestId: input.audit.requestId,
          retentionPolicyRef: input.audit.retentionPolicyRef,
          occurredAt: input.audit.occurredAt,
        });
        await client.query('COMMIT');
        return mapRequest(inserted.rows[0]!);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async transition(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<RequestRow>(
          `SELECT ${requestColumns} FROM privacy.requests WHERE id=$1 AND user_id=$2 FOR UPDATE`,
          [input.requestId, input.userId],
        );
        const current = found.rows[0];
        if (!current || current.version !== input.expectedVersion)
          throw new Error('Privacy request transition conflict');
        const event = input.event;
        if (
          event.requestId !== current.id ||
          event.userId !== current.user_id ||
          event.fromStatus !== current.status ||
          !canTransitionPrivacyRequest(current.status, event.toStatus)
        )
          throw new Error('Invalid privacy request transition');
        const updated = await client.query<RequestRow>(
          `UPDATE privacy.requests SET status=$3,version=version+1,updated_at=$4 WHERE id=$1 AND user_id=$2 RETURNING ${requestColumns}`,
          [current.id, current.user_id, event.toStatus, event.occurredAt],
        );
        await insertEvent(client, event);
        await insertAuditEvent(client, {
          id: input.audit.id,
          eventKey: 'privacy.request_transitioned',
          actorType: input.audit.actorType ?? 'consumer',
          actorId:
            input.audit.actorId === undefined
              ? current.user_id
              : input.audit.actorId,
          subjectId: current.user_id,
          resourceType: 'privacy_request',
          resourceId: current.id,
          action: 'transitioned',
          outcome: 'succeeded',
          requestId: input.audit.requestId,
          retentionPolicyRef: input.audit.retentionPolicyRef,
          occurredAt: input.audit.occurredAt,
        });
        await client.query('COMMIT');
        return mapRequest(updated.rows[0]!);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async findById(id, userId) {
      const result = await pool.query<RequestRow>(
        `SELECT ${requestColumns} FROM privacy.requests WHERE id=$1 AND user_id=$2`,
        [id, userId],
      );
      return result.rows[0] ? mapRequest(result.rows[0]) : null;
    },
    async history(id, userId) {
      const result = await pool.query<EventRow>(
        `SELECT e.id,e.request_id,e.user_id,e.from_status,e.to_status,e.reason_code,e.occurred_at
        FROM privacy.request_events e JOIN privacy.requests r ON r.id=e.request_id
        WHERE e.request_id=$1 AND r.user_id=$2 ORDER BY e.occurred_at,e.id`,
        [id, userId],
      );
      return result.rows.map(mapEvent);
    },
    async listOwn(userId, page) {
      if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 51)
        throw new Error('Invalid privacy request page limit');
      if (
        page.before &&
        (!Number.isFinite(Date.parse(page.before.requestedAt)) ||
          !/^dsr_[A-Za-z0-9_-]{16,64}$/.test(page.before.requestId))
      )
        throw new Error('Invalid privacy request cursor');
      const result = await pool.query<RequestRow>(
        `SELECT ${requestColumns} FROM privacy.requests
         WHERE user_id=$1
           AND ($2::timestamptz IS NULL OR (requested_at,id) < ($2::timestamptz,$3))
         ORDER BY requested_at DESC,id DESC LIMIT $4`,
        [
          userId,
          page.before?.requestedAt ?? null,
          page.before?.requestId ?? null,
          page.limit,
        ],
      );
      return result.rows.map(mapRequest);
    },
  };
}
