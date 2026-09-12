import type { Pool } from 'pg';
import type { DeletionTargetPort } from '@glucora/domain';

export function createPostgresCanonicalHealthDeletionTarget(
  pool: Pool,
): DeletionTargetPort {
  return {
    targetId: 'canonical_health_records',
    targetClass: 'canonical',
    async fulfill(input) {
      await pool.query('SELECT privacy.delete_canonical_health_data($1,$2)', [
        input.privacyRequestId,
        input.userId,
      ]);
      return {
        targetId: 'canonical_health_records',
        targetClass: 'canonical',
        outcome: 'deleted',
        reasonCode: 'deletion_confirmed',
        evidenceRef: `privacy-request:${input.privacyRequestId}`,
        legalHoldRef: null,
        recordedAt: new Date().toISOString(),
      };
    },
  };
}
