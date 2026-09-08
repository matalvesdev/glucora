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
        ).toBe(3);
        await copyFile(
          resolve('infrastructure/migrations/0001_foundation.sql'),
          join(directory, '0001_foundation.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0002_user_accounts.sql'),
          join(directory, '0002_user_accounts.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0003_consent_events.sql'),
          join(directory, '0003_consent_events.sql'),
        );
        await writeFile(
          join(directory, '0004_failure.sql'),
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
        const client = new pg.Client({ connectionString: url.toString() });
        await client.connect();
        try {
          await client.query(
            `INSERT INTO identity.user_accounts (id, locale, timezone)
           VALUES ($1, $2, $3)`,
            ['usr_syntheticconsumer001', 'pt-BR', 'America/Sao_Paulo'],
          );
          await expect(
            ready.users.findById('usr_syntheticconsumer001'),
          ).resolves.toMatchObject({
            id: 'usr_syntheticconsumer001',
            status: 'active',
            locale: 'pt-BR',
          });
          await expect(
            ready.users.findById('usr_missingconsumer000'),
          ).resolves.toBeNull();
          await client.query(
            `INSERT INTO consent.purpose_versions
               (id, purpose_key, version, status, title, notice_text,
                legal_basis_ref, retention_policy_ref, owner_ref, effective_from)
             VALUES ($1, $2, 1, 'published', $3, $4, $5, $6, $7, now()),
                    ($8, $9, 1, 'draft', $3, $4, $5, $6, $7, NULL)`,
            [
              'pur_syntheticpurpose001',
              'synthetic_research_context',
              'Synthetic purpose',
              'Synthetic notice used only for isolated integration testing.',
              'synthetic-legal-review-ref',
              'synthetic-retention-ref',
              'synthetic-compliance-owner',
              'pur_syntheticdraft00001',
              'synthetic_draft_context',
            ],
          );
          const granted = await ready.consents.record({
            id: 'cne_syntheticgrant00001',
            userId: 'usr_syntheticconsumer001',
            purposeVersionId: 'pur_syntheticpurpose001',
            decision: 'granted',
            channel: 'integration-test',
            idempotencyKey: ['test', 'grant', '1'].join('-'),
            occurredAt: new Date().toISOString(),
          });
          expect(granted.decision).toBe('granted');
          await expect(
            ready.consents.record({
              id: granted.id,
              userId: granted.userId,
              purposeVersionId: granted.purposeVersionId,
              decision: granted.decision,
              channel: granted.channel,
              idempotencyKey: granted.idempotencyKey,
              occurredAt: granted.occurredAt,
            }),
          ).resolves.toEqual(granted);
          await expect(
            ready.consents.record({
              id: 'cne_syntheticcollision001',
              userId: granted.userId,
              purposeVersionId: granted.purposeVersionId,
              decision: 'denied',
              channel: granted.channel,
              idempotencyKey: granted.idempotencyKey,
              occurredAt: granted.occurredAt,
            }),
          ).rejects.toThrow('Idempotency key reused');
          await expect(
            ready.consents.record({
              id: 'cne_syntheticdraftgrant1',
              userId: 'usr_syntheticconsumer001',
              purposeVersionId: 'pur_syntheticdraft00001',
              decision: 'granted',
              channel: 'integration-test',
              idempotencyKey: ['test', 'draft', '1'].join('-'),
              occurredAt: new Date().toISOString(),
            }),
          ).rejects.toThrow();
          await ready.consents.record({
            id: 'cne_syntheticrevoke0001',
            userId: 'usr_syntheticconsumer001',
            purposeVersionId: 'pur_syntheticpurpose001',
            decision: 'revoked',
            channel: 'integration-test',
            idempotencyKey: ['test', 'revoke', '1'].join('-'),
            occurredAt: new Date().toISOString(),
          });
          await expect(
            ready.consents.history(
              'usr_syntheticconsumer001',
              'pur_syntheticpurpose001',
            ),
          ).resolves.toMatchObject([
            { decision: 'granted' },
            { decision: 'revoked' },
          ]);
          await expect(
            client.query(
              `UPDATE consent.events SET channel = 'changed' WHERE id = $1`,
              ['cne_syntheticgrant00001'],
            ),
          ).rejects.toThrow();
          await expect(
            client.query(
              `UPDATE consent.purpose_versions SET notice_text = 'changed' WHERE id = $1`,
              ['pur_syntheticpurpose001'],
            ),
          ).rejects.toThrow();
        } finally {
          await client.end();
        }
      } finally {
        await ready.close();
      }
    } finally {
      await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
      await admin.end();
      await rm(directory, { recursive: true, force: true });
    }
  }, 60000);
});
