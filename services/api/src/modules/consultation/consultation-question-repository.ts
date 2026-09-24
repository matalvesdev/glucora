import type { Pool } from 'pg';
import type {
  ConsultationQuestionEvent,
  ConsultationQuestionRepository,
} from '@glucora/domain';
import { insertAuditEvent } from '../audit/audit-repository';
interface Row {
  id: string;
  report_id: string;
  user_id: string;
  question_key: ConsultationQuestionEvent['questionKey'];
  action: ConsultationQuestionEvent['action'];
  version: number;
  occurred_at: Date;
  request_hash: string;
}
const columns =
  'id,report_id,user_id,question_key,action,version,occurred_at,request_hash';
const map = (row: Row): ConsultationQuestionEvent => ({
  id: row.id,
  reportId: row.report_id,
  userId: row.user_id,
  questionKey: row.question_key,
  action: row.action,
  version: row.version,
  occurredAt: row.occurred_at.toISOString(),
});
export function createPostgresConsultationQuestionRepository(
  pool: Pool,
): ConsultationQuestionRepository {
  return {
    async record(input) {
      const value = input.event;
      if (
        !/^rqe_[A-Za-z0-9_-]{16,64}$/.test(value.id) ||
        !/^[a-f0-9]{64}$/.test(input.requestHash) ||
        input.audit.occurredAt !== value.occurredAt
      )
        throw new Error('Invalid consultation question event');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const report = await client.query(
          'SELECT 1 FROM consultation.reports WHERE id=$1 AND user_id=$2 FOR UPDATE',
          [value.reportId, value.userId],
        );
        if (!report.rowCount) throw new Error('Consultation report not owned');
        const prior = await client.query<Row>(
          `SELECT ${columns} FROM consultation.report_question_events WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE`,
          [value.userId, input.idempotencyKey],
        );
        if (prior.rows[0]) {
          if (prior.rows[0].request_hash !== input.requestHash)
            throw new Error('Idempotency key reused');
          await client.query('COMMIT');
          return map(prior.rows[0]);
        }
        const previous = await client.query<{ version: number }>(
          `SELECT version FROM consultation.report_question_events WHERE report_id=$1 AND question_key=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
          [value.reportId, value.questionKey],
        );
        const nextVersion = (previous.rows[0]?.version ?? 0) + 1;
        const inserted = await client.query<Row>(
          `INSERT INTO consultation.report_question_events (${columns.replace(',request_hash', '')},idempotency_key,request_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${columns}`,
          [
            value.id,
            value.reportId,
            value.userId,
            value.questionKey,
            value.action,
            nextVersion,
            value.occurredAt,
            input.idempotencyKey,
            input.requestHash,
          ],
        );
        await insertAuditEvent(client, {
          id: input.audit.id,
          eventKey: 'consultation.question_recorded',
          actorType: 'consumer',
          actorId: value.userId,
          subjectId: value.userId,
          resourceType: 'consultation_report',
          resourceId: value.reportId,
          action: value.action,
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
    async listSelected(reportId, userId) {
      const result = await pool.query<Row>(
        `SELECT DISTINCT ON (question_key) ${columns} FROM consultation.report_question_events WHERE report_id=$1 AND user_id=$2 ORDER BY question_key,version DESC`,
        [reportId, userId],
      );
      return result.rows.filter((row) => row.action === 'added').map(map);
    },
  };
}
