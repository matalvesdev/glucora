import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
export async function migrate(connectionString: string, directory: string) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query('SELECT pg_advisory_xact_lock(18420319)');
    const exists = await client.query<{ table_name: string | null }>(
      "SELECT to_regclass('glucora_meta.schema_migrations')::text AS table_name",
    );
    const applied = new Map<string, string>();
    if (exists.rows[0]?.table_name) {
      const rows = await client.query<{ version: string; checksum: string }>(
        'SELECT version,checksum FROM glucora_meta.schema_migrations',
      );
      for (const row of rows.rows) applied.set(row.version, row.checksum);
    }
    const files = (await readdir(directory))
      .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    for (const version of applied.keys())
      if (!files.includes(version + '.sql'))
        throw new Error('Applied migration missing');
    for (const file of files) {
      const version = file.slice(0, -4);
      const sql = (await readFile(join(directory, file), 'utf8')).replace(
        /\r\n/g,
        '\n',
      );
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (applied.has(version)) {
        if (applied.get(version) !== checksum)
          throw new Error('Migration checksum mismatch');
        continue;
      }
      if ([...applied.keys()].some((v) => v > version))
        throw new Error('Out-of-order migration');
      await client.query(sql);
      await client.query(
        'INSERT INTO glucora_meta.schema_migrations(version,checksum) VALUES ($1,$2)',
        [version, checksum],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
