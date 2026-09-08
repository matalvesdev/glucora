import type { Pool } from 'pg';
import type { UserAccount, UserAccountRepository } from '@glucora/domain';

interface UserAccountRow {
  id: string;
  status: 'active' | 'disabled';
  locale: string;
  timezone: string;
  created_at: Date;
  updated_at: Date;
}

export function createPostgresUserAccountRepository(
  pool: Pool,
): UserAccountRepository {
  return {
    async findById(id): Promise<UserAccount | null> {
      const result = await pool.query<UserAccountRow>(
        `SELECT id, status, locale, timezone, created_at, updated_at
         FROM identity.user_accounts
         WHERE id = $1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        status: row.status,
        locale: row.locale,
        timezone: row.timezone,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    },
  };
}
