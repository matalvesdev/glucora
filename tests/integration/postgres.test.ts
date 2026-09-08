import { randomUUID } from 'node:crypto';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import pg from 'pg';
import { describe, it, expect } from 'vitest';
import { migrate } from '../../scripts/migration-runner';
import { createDatabase } from '../../services/api/src/database';
describe('real PostgreSQL migrations and readiness', () => {
  it('applies once, checks history, rolls back failed DDL and detects schema availability', async () => {
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString)
      throw new Error(
        'TEST_DATABASE_URL is required; integration checks must not silently skip.',
      );
    const admin = new pg.Client({ connectionString });
    await admin.connect();
    const name = 'glucora_test_' + randomUUID().replaceAll('-', '');
    const url = new URL(connectionString);
    url.pathname = '/' + name;
    const directory = await mkdtemp(join(tmpdir(), 'glucora-migrations-'));
    try {
      await admin.query('CREATE DATABASE "' + name + '"');
      const database = createDatabase(url.toString());
      try {
        await expect(database.checkReadiness()).rejects.toThrow();
      } finally {
        await database.close();
      }
      await migrate(url.toString(), resolve('infrastructure/migrations'));
      await migrate(url.toString(), resolve('infrastructure/migrations'));
      const client = new pg.Client({ connectionString: url.toString() });
      await client.connect();
      try {
        expect(
          (await client.query('SELECT * FROM glucora_meta.schema_migrations'))
            .rowCount,
        ).toBe(1);
        await copyFile(
          resolve('infrastructure/migrations/0001_foundation.sql'),
          join(directory, '0001_foundation.sql'),
        );
        await writeFile(
          join(directory, '0002_failure.sql'),
          'CREATE TABLE must_rollback (id int); SELECT * FROM table_that_does_not_exist;',
        );
        await expect(migrate(url.toString(), directory)).rejects.toThrow();
        expect(
          (await client.query("SELECT to_regclass('must_rollback') AS name"))
            .rows[0].name,
        ).toBe(null);
        await writeFile(
          join(directory, '0001_foundation.sql'),
          '-- changed after application',
        );
        await expect(migrate(url.toString(), directory)).rejects.toThrow(
          'Migration checksum mismatch',
        );
      } finally {
        await client.end();
      }
      const ready = createDatabase(url.toString());
      try {
        await expect(ready.checkReadiness()).resolves.toBeUndefined();
      } finally {
        await ready.close();
      }
    } finally {
      await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
      await admin.end();
      await rm(directory, { recursive: true, force: true });
    }
  }, 20000);
});
