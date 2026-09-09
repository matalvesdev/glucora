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
        ).toBe(5);
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
        await copyFile(
          resolve('infrastructure/migrations/0004_audit_events.sql'),
          join(directory, '0004_audit_events.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0005_observation_persistence.sql'),
          join(directory, '0005_observation_persistence.sql'),
        );
        await writeFile(
          join(directory, '0006_failure.sql'),
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
             VALUES ($1, $2, 1, 'published', $3, $4, $5, $6, $7,
                     TIMESTAMPTZ '2020-01-01T00:00:00.000Z'),
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
            ready.consents.current(
              'usr_syntheticconsumer001',
              'pur_syntheticpurpose001',
            ),
          ).resolves.toMatchObject({ decision: 'revoked' });
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
          const auditEvent = await ready.audit.record({
            id: 'aud_syntheticauditevent01',
            eventKey: 'consent.decision_recorded',
            actorType: 'consumer',
            actorId: 'usr_syntheticconsumer001',
            subjectId: 'usr_syntheticconsumer001',
            resourceType: 'consent_event',
            resourceId: 'cne_syntheticrevoke0001',
            action: 'revoked',
            outcome: 'succeeded',
            requestId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
            retentionPolicyRef: 'synthetic-retention-review-ref',
            occurredAt: new Date().toISOString(),
          });
          expect(auditEvent.eventKey).toBe('consent.decision_recorded');
          await expect(
            ready.audit.historyForResource(
              'consent_event',
              'cne_syntheticrevoke0001',
            ),
          ).resolves.toMatchObject([{ action: 'revoked' }]);
          await expect(
            client.query(`DELETE FROM audit.events WHERE id = $1`, [
              'aud_syntheticauditevent01',
            ]),
          ).rejects.toThrow();
          const timestamp = new Date().toISOString();
          const observation = await ready.observations.recordInitial(
            {
              id: 'obs_syntheticmeasure0001',
              version: 1,
              userId: 'usr_syntheticconsumer001',
              type: { system: 'synthetic.test', code: 'measurement' },
              quantity: {
                decimalValue: '123.450000000',
                unit: { system: 'synthetic.units', code: 'unit' },
              },
              occurredAt: timestamp,
              recordedAt: timestamp,
              ingestedAt: timestamp,
              sourceType: 'manual',
              sourceId: 'src_syntheticmanual001',
              provenanceId: 'prv_syntheticorigin001',
              factClass: 'declaration',
              status: 'current',
              createdAt: timestamp,
            },
            {
              id: 'prv_syntheticorigin001',
              userId: 'usr_syntheticconsumer001',
              sourceType: 'manual',
              sourceId: 'src_syntheticmanual001',
              transformationRef: null,
              recordedAt: timestamp,
              createdAt: timestamp,
            },
          );
          expect(observation.quantity.decimalValue).toBe('123.450000000');
          await expect(
            ready.observations.findCurrent(observation.id, observation.userId),
          ).resolves.toMatchObject({ provenanceId: 'prv_syntheticorigin001' });
          await expect(
            ready.observations.findCurrent(
              observation.id,
              'usr_syntheticconsumer002',
            ),
          ).resolves.toBeNull();
          await client.query(
            `INSERT INTO identity.user_accounts (id) VALUES ($1)`,
            ['usr_syntheticconsumer002'],
          );
          await expect(
            client.query(
              `INSERT INTO health.observations
                (id, version, user_id, type_system, type_code, decimal_value,
                 unit_system, unit_code, occurred_at, recorded_at, ingested_at,
                 source_type, source_id, provenance_id, fact_class, status, created_at)
               SELECT $1, version, $2, type_system, type_code, decimal_value,
                 unit_system, unit_code, occurred_at, recorded_at, ingested_at,
                 source_type, source_id, provenance_id, fact_class, status, created_at
               FROM health.observations WHERE id = $3`,
              [
                'obs_syntheticcrossuser01',
                'usr_syntheticconsumer002',
                observation.id,
              ],
            ),
          ).rejects.toThrow();
          await expect(
            client.query(
              `UPDATE health.provenance_records SET source_id = $1 WHERE id = $2`,
              ['src_syntheticchanged001', 'prv_syntheticorigin001'],
            ),
          ).rejects.toThrow();
          await expect(
            client.query(
              `UPDATE health.observations SET decimal_value = 1 WHERE id = $1`,
              [observation.id],
            ),
          ).rejects.toThrow();
          const correctedAt = new Date(Date.now() + 1).toISOString();
          const corrected = await ready.observations.correct({
            replacement: {
              ...observation,
              version: 2,
              quantity: {
                ...observation.quantity,
                decimalValue: '124.000000000',
              },
              sourceId: 'src_syntheticcorrection01',
              provenanceId: 'prv_syntheticcorrection01',
              recordedAt: correctedAt,
              ingestedAt: correctedAt,
              createdAt: correctedAt,
            },
            provenance: {
              id: 'prv_syntheticcorrection01',
              userId: observation.userId,
              sourceType: 'manual',
              sourceId: 'src_syntheticcorrection01',
              transformationRef: null,
              recordedAt: correctedAt,
              createdAt: correctedAt,
            },
            audit: {
              id: 'aud_syntheticcorrection001',
              requestId: 'c4f5c443-e30b-4b42-82ba-f00a2062c6dd',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: correctedAt,
            },
          });
          expect(corrected.version).toBe(2);
          await expect(
            ready.observations.findCurrent(observation.id, observation.userId),
          ).resolves.toMatchObject({
            version: 2,
            quantity: { decimalValue: '124.000000000' },
          });
          expect(
            (
              await client.query(
                `SELECT version, status FROM health.observations
                 WHERE id = $1 ORDER BY version`,
                [observation.id],
              )
            ).rows,
          ).toEqual([
            { version: 1, status: 'superseded' },
            { version: 2, status: 'current' },
          ]);
          await expect(
            ready.audit.historyForResource('observation', observation.id),
          ).resolves.toMatchObject([
            { action: 'corrected', outcome: 'succeeded' },
          ]);
          await expect(
            ready.observations.correct({
              replacement: {
                ...corrected,
                sourceId: 'src_syntheticconflict001',
                provenanceId: 'prv_syntheticconflict001',
              },
              provenance: {
                id: 'prv_syntheticconflict001',
                userId: observation.userId,
                sourceType: 'manual',
                sourceId: 'src_syntheticconflict001',
                transformationRef: null,
                recordedAt: correctedAt,
                createdAt: correctedAt,
              },
              audit: {
                id: 'aud_syntheticconflict0001',
                requestId: '6995da74-fcd6-4ded-a528-2109903ff971',
                retentionPolicyRef: 'synthetic-retention-review-ref',
                occurredAt: correctedAt,
              },
            }),
          ).rejects.toThrow('correction conflict');
          await expect(
            ready.observations.correct({
              replacement: {
                ...corrected,
                version: 3,
                sourceId: 'src_syntheticrollback001',
                provenanceId: 'prv_syntheticrollback001',
              },
              provenance: {
                id: 'prv_syntheticrollback001',
                userId: observation.userId,
                sourceType: 'manual',
                sourceId: 'src_syntheticrollback001',
                transformationRef: null,
                recordedAt: correctedAt,
                createdAt: correctedAt,
              },
              audit: {
                id: 'aud_syntheticrollback0001',
                requestId: 'invalid-request-id',
                retentionPolicyRef: 'synthetic-retention-review-ref',
                occurredAt: correctedAt,
              },
            }),
          ).rejects.toThrow();
          await expect(
            ready.observations.findCurrent(observation.id, observation.userId),
          ).resolves.toMatchObject({ version: 2 });
          expect(
            (
              await client.query(
                `SELECT count(*)::integer AS count FROM health.provenance_records
                 WHERE id = $1`,
                ['prv_syntheticrollback001'],
              )
            ).rows[0].count,
          ).toBe(0);
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
