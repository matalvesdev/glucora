import type {
  DeletionTargetReceiptRepository,
  PersistedDeletionTargetReceipt,
} from '@glucora/domain';
import type { Pool } from 'pg';

interface Row {
  id: string;
  request_id: string;
  user_id: string;
  target_id: PersistedDeletionTargetReceipt['targetId'];
  target_class: PersistedDeletionTargetReceipt['targetClass'];
  outcome: PersistedDeletionTargetReceipt['outcome'];
  reason_code: string;
  evidence_ref: string | null;
  legal_hold_ref: string | null;
  recorded_at: Date;
}
const columns =
  'id,request_id,user_id,target_id,target_class,outcome,reason_code,evidence_ref,legal_hold_ref,recorded_at';
const map = (row: Row): PersistedDeletionTargetReceipt => ({
  id: row.id,
  privacyRequestId: row.request_id,
  userId: row.user_id,
  targetId: row.target_id,
  targetClass: row.target_class,
  outcome: row.outcome,
  reasonCode: row.reason_code,
  evidenceRef: row.evidence_ref,
  legalHoldRef: row.legal_hold_ref,
  recordedAt: row.recorded_at.toISOString(),
});

export function createPostgresDeletionTargetReceiptRepository(
  pool: Pool,
): DeletionTargetReceiptRepository {
  return {
    async record(input) {
      const result = await pool.query<Row>(
        `INSERT INTO privacy.deletion_target_receipts
          (id,request_id,user_id,target_id,target_class,outcome,reason_code,evidence_ref,legal_hold_ref,recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${columns}`,
        [
          input.id,
          input.privacyRequestId,
          input.userId,
          input.targetId,
          input.targetClass,
          input.outcome,
          input.reasonCode,
          input.evidenceRef,
          input.legalHoldRef,
          input.recordedAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Deletion receipt was not recorded');
      return map(row);
    },
  };
}
