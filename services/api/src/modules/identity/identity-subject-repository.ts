import type { IdentitySubjectRepository } from '@glucora/domain';
import type { Pool } from 'pg';

export function createPostgresIdentitySubjectRepository(
  pool: Pool,
): IdentitySubjectRepository {
  return {
    async resolveConsumerId(subject) {
      const result = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM identity.subject_bindings
         WHERE provider = 'identity_platform' AND subject = $1`,
        [subject],
      );
      return result.rows[0]?.user_id ?? null;
    },
  };
}
