import type { Pool } from 'pg';
import type { SupportRequest, SupportRequestRepository } from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';

interface Row {
  id: string;
  user_id: string;
  category: SupportRequest['category'];
  status: 'submitted';
  created_at: Date;
  request_hash: string;
}
const columns = 'id,user_id,category,status,created_at,request_hash';
const map = (row: Row): SupportRequest => ({
  id: row.id,
  userId: row.user_id,
  category: row.category,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

export function createPostgresSupportRequestRepository(
  pool: Pool,
): SupportRequestRepository {
  return {
    async create(input) {
      const value = input.request;
      if (
        value.status !== 'submitted' ||
        input.audit.occurredAt !== value.createdAt ||
        !/^[a-f0-9]{64}$/.test(input.requestHash)
      )
        throw new Error('Invalid support request');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query<Row>(
          `SELECT ${columns} FROM support.requests WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE`,
          [value.userId, input.idempotencyKey],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].request_hash !== input.requestHash)
            throw new Error('Idempotency key reused');
          await client.query('COMMIT');
          return map(existing.rows[0]);
        }
        const inserted = await client.query<Row>(
          `INSERT INTO support.requests
            (id,user_id,category,status,created_at,idempotency_key,request_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`,
          [
            value.id,
            value.userId,
            value.category,
            value.status,
            value.createdAt,
            input.idempotencyKey,
            input.requestHash,
          ],
        );
        await insertAuditEvent(client, {
          id: input.audit.id,
          eventKey: 'support.request_created',
          actorType: 'consumer',
          actorId: value.userId,
          subjectId: value.userId,
          resourceType: 'support_request',
          resourceId: value.id,
          action: 'created',
          outcome: 'succeeded',
          requestId: input.audit.requestId,
          retentionPolicyRef: input.audit.retentionPolicyRef,
          occurredAt: input.audit.occurredAt,
        });
        await client.query('COMMIT');
        return map(inserted.rows[0]!);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async listOwn(userId, page) {
      if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 51)
        throw new Error('Invalid support request limit');
      if (
        page.before &&
        (!Number.isFinite(Date.parse(page.before.createdAt)) ||
          !/^sup_[A-Za-z0-9_-]{16,64}$/.test(page.before.requestId))
      )
        throw new Error('Invalid support request cursor');
      const result = await pool.query<Row>(
        `SELECT ${columns} FROM support.requests
         WHERE user_id=$1
           AND ($2::timestamptz IS NULL OR (created_at,id) < ($2::timestamptz,$3))
         ORDER BY created_at DESC,id DESC LIMIT $4`,
        [
          userId,
          page.before?.createdAt ?? null,
          page.before?.requestId ?? null,
          page.limit,
        ],
      );
      return result.rows.map(map);
    },
  };
}
