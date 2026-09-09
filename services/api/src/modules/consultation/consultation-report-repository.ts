import type { Pool, PoolClient } from 'pg';
import type {
  ConsultationReport,
  ConsultationReportRepository,
} from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';

interface Row {
  id: string;
  user_id: string;
  period_from: Date;
  period_to: Date;
  generated_at: Date;
  total_records: number;
  counts_by_category: Record<string, number>;
  counts_by_source_type: Record<string, number>;
  limitations: ConsultationReport['summary']['limitations'];
  request_hash: string;
  created_at: Date;
}
const columns = `id, user_id, period_from, period_to, generated_at, total_records,
 counts_by_category, counts_by_source_type, limitations, request_hash, created_at`;

async function map(
  client: Pool | PoolClient,
  row: Row,
): Promise<ConsultationReport> {
  const refs = await client.query<{
    timeline_item_id: string;
    source_version: number;
  }>(
    `SELECT timeline_item_id, source_version FROM consultation.report_sources WHERE report_id = $1 ORDER BY timeline_item_id`,
    [row.id],
  );
  return {
    id: row.id,
    userId: row.user_id,
    summary: {
      period: {
        from: row.period_from.toISOString(),
        to: row.period_to.toISOString(),
      },
      generatedAt: row.generated_at.toISOString(),
      totalRecords: row.total_records,
      countsByCategory: row.counts_by_category,
      countsBySourceType: row.counts_by_source_type,
      limitations: row.limitations,
    },
    sourceRefs: refs.rows.map((ref) => ({
      timelineItemId: ref.timeline_item_id,
      sourceVersion: ref.source_version,
    })),
    createdAt: row.created_at.toISOString(),
  };
}

export function createPostgresConsultationReportRepository(
  pool: Pool,
): ConsultationReportRepository {
  return {
    async create(input) {
      const { report } = input;
      if (
        !/^rpt_[A-Za-z0-9_-]{16,64}$/.test(report.id) ||
        !/^[a-f0-9]{64}$/.test(input.requestHash)
      )
        throw new Error('Invalid consultation report');
      if (report.summary.totalRecords !== report.sourceRefs.length)
        throw new Error('Report source count mismatch');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query<Row>(
          `SELECT ${columns} FROM consultation.reports WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE`,
          [report.userId, input.idempotencyKey],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].request_hash !== input.requestHash)
            throw new Error('Idempotency key reused');
          const value = await map(client, existing.rows[0]);
          await client.query('COMMIT');
          return value;
        }
        const inserted = await client.query<Row>(
          `INSERT INTO consultation.reports
          (id,user_id,period_from,period_to,generated_at,total_records,counts_by_category,counts_by_source_type,limitations,idempotency_key,request_hash,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${columns}`,
          [
            report.id,
            report.userId,
            report.summary.period.from,
            report.summary.period.to,
            report.summary.generatedAt,
            report.summary.totalRecords,
            JSON.stringify(report.summary.countsByCategory),
            JSON.stringify(report.summary.countsBySourceType),
            report.summary.limitations,
            input.idempotencyKey,
            input.requestHash,
            report.createdAt,
          ],
        );
        for (const ref of report.sourceRefs)
          await client.query(
            `INSERT INTO consultation.report_sources (report_id,timeline_item_id,source_version) VALUES ($1,$2,$3)`,
            [report.id, ref.timelineItemId, ref.sourceVersion],
          );
        await insertAuditEvent(client, {
          id: input.audit.id,
          eventKey: 'consultation.report_created',
          actorType: 'consumer',
          actorId: report.userId,
          subjectId: report.userId,
          resourceType: 'consultation_report',
          resourceId: report.id,
          action: 'created',
          outcome: 'succeeded',
          requestId: input.audit.requestId,
          retentionPolicyRef: input.audit.retentionPolicyRef,
          occurredAt: input.audit.occurredAt,
        });
        await client.query('COMMIT');
        return map(pool, inserted.rows[0]!);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async findById(id, userId) {
      const result = await pool.query<Row>(
        `SELECT ${columns} FROM consultation.reports WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return result.rows[0] ? map(pool, result.rows[0]) : null;
    },
  };
}
