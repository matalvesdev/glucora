import { randomUUID } from 'node:crypto';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import pg from 'pg';
import { describe, it, expect } from 'vitest';
import { migrate } from '../../scripts/migration-runner';
import { createDatabase } from '../../services/api/src/database';
import { buildApp } from '../../services/api/src/app';
import { createDevelopmentIdentityAdapter } from '../../services/api/src/modules/identity/identity-adapter';
import { createLogger } from '../../packages/observability/src/index';
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
        ).toBe(14);
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
        await copyFile(
          resolve('infrastructure/migrations/0006_observation_timezone.sql'),
          join(directory, '0006_observation_timezone.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0007_context_events.sql'),
          join(directory, '0007_context_events.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0008_timeline_projection.sql'),
          join(directory, '0008_timeline_projection.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0009_consultation_reports.sql'),
          join(directory, '0009_consultation_reports.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0010_privacy_requests.sql'),
          join(directory, '0010_privacy_requests.sql'),
        );
        await copyFile(
          resolve(
            'infrastructure/migrations/0011_privacy_request_transition_guard.sql',
          ),
          join(directory, '0011_privacy_request_transition_guard.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0012_share_grants.sql'),
          join(directory, '0012_share_grants.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0013_output_contestations.sql'),
          join(directory, '0013_output_contestations.sql'),
        );
        await copyFile(
          resolve('infrastructure/migrations/0014_support_requests.sql'),
          join(directory, '0014_support_requests.sql'),
        );
        await writeFile(
          join(directory, '0015_failure.sql'),
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
          const api = buildApp({
            checkReadiness: ready.checkReadiness,
            identity: createDevelopmentIdentityAdapter(),
            users: ready.users,
            privacyRequests: ready.privacyRequests,
            privacyRequestPolicy: {
              retentionPolicyRef: 'synthetic-retention-review-ref',
            },
            logger: createLogger('silent'),
          });
          try {
            const created = await api.inject({
              method: 'POST',
              url: '/v1/privacy-requests',
              headers: {
                'x-glucora-dev-actor': 'usr_syntheticconsumer001',
                'idempotency-key': 'synthetic-api-request-1',
              },
              payload: { kind: 'access' },
            });
            expect(created.statusCode).toBe(201);
            const createdBody = created.json<{ id: string }>();
            const status = await api.inject({
              url: `/v1/privacy-requests/${createdBody.id}`,
              headers: {
                'x-glucora-dev-actor': 'usr_syntheticconsumer001',
              },
            });
            expect(status.statusCode).toBe(200);
            expect(status.json()).toMatchObject({
              id: createdBody.id,
              kind: 'access',
              status: 'requested',
            });
          } finally {
            await api.close();
          }
          const contextTime = '2026-01-01T10:00:00.000Z';
          await client.query(
            `INSERT INTO health.provenance_records
              (id, user_id, source_type, source_id, recorded_at, created_at)
             VALUES ($1, $2, 'manual', $3, $4, $4)`,
            [
              'prv_synthetictimeline001',
              'usr_syntheticconsumer001',
              'src_synthetictimeline001',
              contextTime,
            ],
          );
          await client.query(
            `INSERT INTO health.context_events
              (id, version, user_id, category_system, category_code, note,
               occurred_at, observed_timezone, utc_offset_minutes, recorded_at,
               ingested_at, source_type, source_id, provenance_id, fact_class,
               status, created_at)
             VALUES ($1, 1, $2, 'synthetic.context', 'meal', NULL, $3,
               'America/Sao_Paulo', -180, $3, $3, 'manual', $4, $5,
               'declaration', 'current', $3)`,
            [
              'ctx_synthetictimeline001',
              'usr_syntheticconsumer001',
              contextTime,
              'src_synthetictimeline001',
              'prv_synthetictimeline001',
            ],
          );
          await expect(
            ready.timeline.rebuild(
              'usr_syntheticconsumer001',
              '2026-01-02T00:00:00.000Z',
            ),
          ).resolves.toBe(1);
          const projectedItems = await ready.timeline.list(
            'usr_syntheticconsumer001',
            { limit: 10 },
          );
          const reportInput = {
            report: {
              id: 'rpt_syntheticreport0001',
              userId: 'usr_syntheticconsumer001',
              summary: {
                period: {
                  from: '2026-01-01T00:00:00.000Z',
                  to: '2026-01-03T00:00:00.000Z',
                },
                generatedAt: '2026-01-03T00:00:00.000Z',
                totalRecords: 1,
                countsByCategory: { 'synthetic.context|meal': 1 },
                countsBySourceType: { manual: 1 },
                limitations: [
                  'summary_is_descriptive_only' as const,
                  'missing_records_do_not_mean_events_did_not_happen' as const,
                  'record_count_does_not_measure_health_or_control' as const,
                ],
              },
              sourceRefs: [
                {
                  timelineItemId: projectedItems[0]!.id,
                  sourceVersion: projectedItems[0]!.sourceVersion,
                },
              ],
              createdAt: '2026-01-03T00:00:00.000Z',
            },
            idempotencyKey: 'synthetic-report-key-1',
            requestHash: 'a'.repeat(64),
            audit: {
              id: 'aud_syntheticreport00001',
              requestId: '762ecb91-a610-439b-983f-84c8d28dd3e7',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: '2026-01-03T00:00:00.000Z',
            },
          };
          const report = await ready.consultationReports.create(reportInput);
          expect(report.sourceRefs).toEqual(reportInput.report.sourceRefs);
          await expect(
            ready.consultationReports.create(reportInput),
          ).resolves.toEqual(report);
          await expect(
            ready.consultationReports.create({
              ...reportInput,
              requestHash: 'b'.repeat(64),
            }),
          ).rejects.toThrow('Idempotency key reused');
          await expect(
            ready.consultationReports.findById(
              report.id,
              'usr_syntheticconsumer002',
            ),
          ).resolves.toBeNull();
          await expect(
            client.query(
              `UPDATE consultation.reports SET total_records = 0 WHERE id = $1`,
              [report.id],
            ),
          ).rejects.toThrow();
          const contestation = await ready.outputContestations.record(
            {
              id: 'fbk_syntheticcontest0001',
              userId: 'usr_syntheticconsumer001',
              resourceType: 'consultation_report',
              resourceId: report.id,
              resourceVersion: report.createdAt,
              reason: 'missing_context',
              status: 'open',
              occurredAt: '2026-01-04T00:00:00.000Z',
            },
            {
              id: 'aud_syntheticfeedback0001',
              requestId: '9caab91a-b84e-4d30-8dd3-a7f777cb4bee',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: '2026-01-04T00:00:00.000Z',
            },
          );
          expect(contestation.reason).toBe('missing_context');
          await expect(
            ready.outputContestations.listOpen(
              contestation.userId,
              contestation.resourceType,
              [report.id],
            ),
          ).resolves.toMatchObject([{ id: contestation.id }]);
          await expect(
            ready.outputContestations.listOpen(
              'usr_syntheticconsumer002',
              contestation.resourceType,
              [report.id],
            ),
          ).resolves.toEqual([]);
          await expect(
            client.query(
              `UPDATE privacy.output_contestations SET reason='unclear' WHERE id=$1`,
              [contestation.id],
            ),
          ).rejects.toThrow();
          const supportInput = {
            request: {
              id: 'sup_syntheticrequest0001',
              userId: 'usr_syntheticconsumer001',
              category: 'technical_issue' as const,
              status: 'submitted' as const,
              createdAt: '2026-01-04T00:00:00.000Z',
            },
            idempotencyKey: 'synthetic-support-key-1',
            requestHash: 'd'.repeat(64),
            audit: {
              id: 'aud_syntheticsupport0001',
              requestId: '48a32814-5309-4237-a751-b69010af6a55',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: '2026-01-04T00:00:00.000Z',
            },
          };
          const supportRequest =
            await ready.supportRequests.create(supportInput);
          await expect(
            ready.supportRequests.create(supportInput),
          ).resolves.toEqual(supportRequest);
          await expect(
            ready.supportRequests.create({
              ...supportInput,
              requestHash: 'e'.repeat(64),
            }),
          ).rejects.toThrow('Idempotency key reused');
          await expect(
            ready.supportRequests.listOwn(supportRequest.userId, 10),
          ).resolves.toMatchObject([{ id: supportRequest.id }]);
          await expect(
            ready.supportRequests.listOwn('usr_syntheticconsumer002', 10),
          ).resolves.toEqual([]);
          await expect(
            client.query(
              `UPDATE support.requests SET category='sharing' WHERE id=$1`,
              [supportRequest.id],
            ),
          ).rejects.toThrow();
          await expect(
            ready.audit.historyForResource(
              'support_request',
              supportRequest.id,
            ),
          ).resolves.toMatchObject([
            { action: 'created', outcome: 'succeeded' },
          ]);
          const privacyInput = {
            request: {
              id: 'dsr_syntheticrequest0001',
              userId: 'usr_syntheticconsumer001',
              kind: 'export' as const,
              scope: 'all_user_data' as const,
              status: 'requested' as const,
              version: 1,
              requestedAt: '2026-01-04T00:00:00.000Z',
              updatedAt: '2026-01-04T00:00:00.000Z',
            },
            event: {
              id: 'dse_syntheticrequested001',
              requestId: 'dsr_syntheticrequest0001',
              userId: 'usr_syntheticconsumer001',
              fromStatus: null,
              toStatus: 'requested' as const,
              reasonCode: 'user_requested',
              occurredAt: '2026-01-04T00:00:00.000Z',
            },
            idempotencyKey: ['test', 'privacy', '1'].join('-'),
            requestHash: 'c'.repeat(64),
            audit: {
              id: 'aud_syntheticprivacy0001',
              requestId: 'a172b956-2638-442f-87b2-8449ec3e57b3',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: '2026-01-04T00:00:00.000Z',
            },
          };
          const privacyRequest =
            await ready.privacyRequests.create(privacyInput);
          await expect(
            ready.privacyRequests.create(privacyInput),
          ).resolves.toEqual(privacyRequest);
          const inReview = await ready.privacyRequests.transition({
            requestId: privacyRequest.id,
            userId: privacyRequest.userId,
            expectedVersion: 1,
            event: {
              id: 'dse_syntheticreview00001',
              requestId: privacyRequest.id,
              userId: privacyRequest.userId,
              fromStatus: 'requested',
              toStatus: 'in_review',
              reasonCode: 'identity_confirmed',
              occurredAt: '2026-01-05T00:00:00.000Z',
            },
            audit: {
              id: 'aud_syntheticprivacy0002',
              requestId: 'e7f61c3f-c733-4d75-8e80-ddfd825c089a',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: '2026-01-05T00:00:00.000Z',
            },
          });
          expect(inReview).toMatchObject({ status: 'in_review', version: 2 });
          await expect(
            ready.privacyRequests.transition({
              requestId: privacyRequest.id,
              userId: privacyRequest.userId,
              expectedVersion: 1,
              event: {
                ...privacyInput.event,
                id: 'dse_syntheticstale00001',
                fromStatus: 'requested',
                toStatus: 'cancelled',
              },
              audit: privacyInput.audit,
            }),
          ).rejects.toThrow('transition conflict');
          await expect(
            ready.privacyRequests.history(
              privacyRequest.id,
              privacyRequest.userId,
            ),
          ).resolves.toMatchObject([
            { fromStatus: null, toStatus: 'requested' },
            { fromStatus: 'requested', toStatus: 'in_review' },
          ]);
          await expect(
            client.query(
              `UPDATE privacy.requests SET status='requested', version=3 WHERE id=$1`,
              [privacyRequest.id],
            ),
          ).rejects.toThrow();
          await expect(
            ready.timeline.list('usr_syntheticconsumer001', { limit: 10 }),
          ).resolves.toMatchObject([
            {
              sourceKind: 'context_event',
              sourceId: 'ctx_synthetictimeline001',
              category: { code: 'meal' },
              factClass: 'declaration',
            },
          ]);
          await expect(
            ready.timeline.rebuild(
              'usr_syntheticconsumer001',
              '2026-01-03T00:00:00.000Z',
            ),
          ).resolves.toBe(1);
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
          const share = await ready.shareGrants.create(
            {
              id: 'shr_syntheticshare000001',
              ownerUserId: 'usr_syntheticconsumer001',
              recipientRef: 'rcp_syntheticrecipient01',
              resourceType: 'consultation_report',
              resourceId: report.id,
              purposeVersionId: 'pur_syntheticpurpose001',
              status: 'active',
              version: 1,
              grantedAt: '2026-01-06T00:00:00.000Z',
              expiresAt: '2026-01-13T00:00:00.000Z',
              revokedAt: null,
            },
            {
              id: 'aud_syntheticshare000001',
              requestId: '4d185911-e08a-40cb-bc9f-0ea04c33be7f',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: '2026-01-06T00:00:00.000Z',
            },
          );
          expect(share.status).toBe('active');
          await expect(
            ready.shareGrants.findById(share.id, 'usr_syntheticconsumer002'),
          ).resolves.toBeNull();
          const revokedShare = await ready.shareGrants.revoke(
            share.id,
            share.ownerUserId,
            1,
            '2026-01-07T00:00:00.000Z',
            {
              id: 'aud_syntheticshare000002',
              requestId: 'ed1d625d-47bf-42a8-8e56-444bb93fa287',
              retentionPolicyRef: 'synthetic-retention-review-ref',
              occurredAt: '2026-01-07T00:00:00.000Z',
            },
          );
          expect(revokedShare).toMatchObject({ status: 'revoked', version: 2 });
          await expect(
            ready.shareGrants.revoke(
              share.id,
              share.ownerUserId,
              1,
              '2026-01-08T00:00:00.000Z',
              {
                id: 'aud_syntheticshare000003',
                requestId: '2f491ef2-b5ac-4624-8525-cc24a2529a98',
                retentionPolicyRef: 'synthetic-retention-review-ref',
                occurredAt: '2026-01-08T00:00:00.000Z',
              },
            ),
          ).rejects.toThrow('revocation conflict');
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
              observedTimezone: 'America/Sao_Paulo',
              utcOffsetMinutes: -180,
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
          await expect(
            ready.observations.listCurrent(observation.userId, { limit: 10 }),
          ).resolves.toMatchObject([{ id: observation.id }]);
          await expect(
            ready.observations.listCurrent(observation.userId, {
              limit: 10,
              before: {
                occurredAt: observation.occurredAt,
                id: observation.id,
              },
            }),
          ).resolves.toEqual([]);
          await expect(
            ready.observations.listCurrent(observation.userId, { limit: 0 }),
          ).rejects.toThrow('page limit');
          await client.query(
            `INSERT INTO identity.user_accounts (id) VALUES ($1)`,
            ['usr_syntheticconsumer002'],
          );
          await expect(
            client.query(
              `INSERT INTO health.observations
                (id, version, user_id, type_system, type_code, decimal_value,
                 unit_system, unit_code, occurred_at, observed_timezone,
                 utc_offset_minutes, recorded_at, ingested_at,
                 source_type, source_id, provenance_id, fact_class, status, created_at)
               SELECT $1, version, $2, type_system, type_code, decimal_value,
                 unit_system, unit_code, occurred_at, observed_timezone,
                 utc_offset_minutes, recorded_at, ingested_at,
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
