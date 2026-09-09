import type { Pool } from 'pg';
import type { TimelineItem, TimelineRepository } from '@glucora/domain';

interface Row {
  id: string;
  user_id: string;
  source_kind: TimelineItem['sourceKind'];
  source_id: string;
  source_version: number;
  category_system: string;
  category_code: string;
  fact_class: TimelineItem['factClass'];
  source_type: TimelineItem['sourceType'];
  occurred_at: Date;
  observed_timezone: string;
  utc_offset_minutes: number;
  projected_at: Date;
}
const columns = `id, user_id, source_kind, source_id, source_version, category_system,
 category_code, fact_class, source_type, occurred_at, observed_timezone, utc_offset_minutes, projected_at`;
const map = (row: Row): TimelineItem => ({
  id: row.id,
  userId: row.user_id,
  sourceKind: row.source_kind,
  sourceId: row.source_id,
  sourceVersion: row.source_version,
  category: { system: row.category_system, code: row.category_code },
  factClass: row.fact_class,
  sourceType: row.source_type,
  occurredAt: row.occurred_at.toISOString(),
  observedTimezone: row.observed_timezone,
  utcOffsetMinutes: row.utc_offset_minutes,
  projectedAt: row.projected_at.toISOString(),
});

export function createPostgresTimelineRepository(
  pool: Pool,
): TimelineRepository {
  return {
    async rebuild(userId, projectedAt) {
      if (
        !/^usr_[A-Za-z0-9_-]{16,64}$/.test(userId) ||
        new Date(projectedAt).toISOString() !== projectedAt
      )
        throw new Error('Invalid timeline rebuild request');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          userId,
        ]);
        await client.query('DELETE FROM timeline.items WHERE user_id = $1', [
          userId,
        ]);
        const result = await client.query(
          `INSERT INTO timeline.items (${columns})
           SELECT 'tli_obs_' || md5(o.id || ':' || o.version), o.user_id, 'observation', o.id, o.version,
             o.type_system, o.type_code, o.fact_class, o.source_type, o.occurred_at,
             o.observed_timezone, o.utc_offset_minutes, $2::timestamptz
           FROM health.observations o WHERE o.user_id = $1 AND o.status = 'current'
           UNION ALL
           SELECT 'tli_ctx_' || md5(c.id || ':' || c.version), c.user_id, 'context_event', c.id, c.version,
             c.category_system, c.category_code, c.fact_class, c.source_type, c.occurred_at,
             c.observed_timezone, c.utc_offset_minutes, $2::timestamptz
           FROM health.context_events c WHERE c.user_id = $1 AND c.status = 'current'`,
          [userId, projectedAt],
        );
        await client.query('COMMIT');
        return result.rowCount ?? 0;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async list(userId, query) {
      if (
        !Number.isInteger(query.limit) ||
        query.limit < 1 ||
        query.limit > 100
      )
        throw new Error('Invalid timeline page limit');
      const values: unknown[] = [userId, query.limit];
      let filters = '';
      if (query.sourceKind) {
        values.push(query.sourceKind);
        filters += ` AND source_kind = $${values.length}`;
      }
      if (query.category) {
        values.push(query.category.system, query.category.code);
        filters += ` AND category_system = $${values.length - 1} AND category_code = $${values.length}`;
      }
      if (query.occurredFrom) {
        values.push(query.occurredFrom);
        filters += ` AND occurred_at >= $${values.length}::timestamptz`;
      }
      if (query.occurredTo) {
        values.push(query.occurredTo);
        filters += ` AND occurred_at < $${values.length}::timestamptz`;
      }
      if (query.before) {
        values.push(query.before.occurredAt, query.before.id);
        filters += ` AND (occurred_at, id) < ($${values.length - 1}::timestamptz, $${values.length})`;
      }
      const result = await pool.query<Row>(
        `SELECT ${columns} FROM timeline.items WHERE user_id = $1${filters} ORDER BY occurred_at DESC, id DESC LIMIT $2`,
        values,
      );
      return result.rows.map(map);
    },
  };
}
