import type { Pool } from 'pg';
import type { DeletionTargetPort } from '@glucora/domain';

export function createPostgresTimelineProjectionDeletionTarget(
  pool: Pool,
  now: () => Date = () => new Date(),
): DeletionTargetPort {
  return {
    targetId: 'timeline_projection',
    targetClass: 'projection',
    async fulfill(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const request = await client.query(
          `SELECT 1 FROM privacy.requests
            WHERE id=$1 AND user_id=$2 AND kind='deletion' AND status='in_review'
            FOR UPDATE`,
          [input.privacyRequestId, input.userId],
        );
        if (request.rowCount !== 1)
          throw new Error('Deletion request is not eligible');
        await client.query('DELETE FROM timeline.items WHERE user_id=$1', [
          input.userId,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return {
        targetId: 'timeline_projection',
        targetClass: 'projection',
        outcome: 'deleted',
        reasonCode: 'deletion_confirmed',
        evidenceRef: `privacy-request:${input.privacyRequestId}`,
        legalHoldRef: null,
        recordedAt: now().toISOString(),
      };
    },
  };
}
