import type { Pool } from 'pg';
import type { ShareGrant, ShareGrantRepository } from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';

interface Row {
  id: string;
  owner_user_id: string;
  recipient_ref: string;
  resource_type: ShareGrant['resourceType'];
  resource_id: string;
  purpose_version_id: string;
  status: ShareGrant['status'];
  version: number;
  granted_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}
const columns =
  'id,owner_user_id,recipient_ref,resource_type,resource_id,purpose_version_id,status,version,granted_at,expires_at,revoked_at';
const map = (row: Row): ShareGrant => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  recipientRef: row.recipient_ref,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  purposeVersionId: row.purpose_version_id,
  status: row.status,
  version: row.version,
  grantedAt: row.granted_at.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  revokedAt: row.revoked_at?.toISOString() ?? null,
});

export function createPostgresShareGrantRepository(
  pool: Pool,
): ShareGrantRepository {
  return {
    async create(grant, audit) {
      if (
        grant.status !== 'active' ||
        grant.version !== 1 ||
        grant.revokedAt !== null ||
        Date.parse(grant.grantedAt) >= Date.parse(grant.expiresAt) ||
        audit.occurredAt !== grant.grantedAt
      )
        throw new Error('Invalid share grant');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const report = await client.query(
          `SELECT 1 FROM consultation.reports WHERE id=$1 AND user_id=$2`,
          [grant.resourceId, grant.ownerUserId],
        );
        if (report.rowCount !== 1) throw new Error('Share resource not owned');
        const result = await client.query<Row>(
          `INSERT INTO sharing.grants (${columns}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${columns}`,
          [
            grant.id,
            grant.ownerUserId,
            grant.recipientRef,
            grant.resourceType,
            grant.resourceId,
            grant.purposeVersionId,
            grant.status,
            grant.version,
            grant.grantedAt,
            grant.expiresAt,
            grant.revokedAt,
          ],
        );
        await insertAuditEvent(client, {
          id: audit.id,
          eventKey: 'sharing.grant_created',
          actorType: 'consumer',
          actorId: grant.ownerUserId,
          subjectId: grant.ownerUserId,
          resourceType: 'share_grant',
          resourceId: grant.id,
          action: 'created',
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
    async revoke(id, ownerUserId, expectedVersion, revokedAt, audit) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = await client.query<Row>(
          `SELECT ${columns} FROM sharing.grants WHERE id=$1 AND owner_user_id=$2 FOR UPDATE`,
          [id, ownerUserId],
        );
        const grant = current.rows[0];
        if (
          !grant ||
          grant.status !== 'active' ||
          grant.version !== expectedVersion
        )
          throw new Error('Share grant revocation conflict');
        const result = await client.query<Row>(
          `UPDATE sharing.grants SET status='revoked',version=version+1,revoked_at=$3 WHERE id=$1 AND owner_user_id=$2 RETURNING ${columns}`,
          [id, ownerUserId, revokedAt],
        );
        await insertAuditEvent(client, {
          id: audit.id,
          eventKey: 'sharing.grant_revoked',
          actorType: 'consumer',
          actorId: ownerUserId,
          subjectId: ownerUserId,
          resourceType: 'share_grant',
          resourceId: id,
          action: 'revoked',
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
    async findById(id, ownerUserId) {
      const result = await pool.query<Row>(
        `SELECT ${columns} FROM sharing.grants WHERE id=$1 AND owner_user_id=$2`,
        [id, ownerUserId],
      );
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async listOwn(ownerUserId, input = { limit: 20 }) {
      const values: unknown[] = [ownerUserId];
      let predicate = '';
      if (input.before) {
        const cursor = JSON.parse(
          Buffer.from(input.before, 'base64url').toString('utf8'),
        ) as { grantedAt: string; id: string };
        values.push(cursor.grantedAt, cursor.id);
        predicate = ' AND (granted_at,id) < ($2,$3)';
      }
      values.push(input.limit);
      const result = await pool.query<Row>(
        `SELECT ${columns} FROM sharing.grants WHERE owner_user_id=$1${predicate} ORDER BY granted_at DESC,id DESC LIMIT $${values.length}`,
        values,
      );
      return result.rows.map(map);
    },
  };
}
