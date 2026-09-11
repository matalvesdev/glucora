import pg from 'pg';
import { createPostgresUserAccountRepository } from './modules/identity/user-account-repository';
import {
  createPostgresConsentDecisionRecorder,
  createPostgresConsentPurposeRepository,
  createPostgresConsentRepository,
} from './modules/consent/consent-repository';
import { createPostgresAuditRepository } from './modules/audit/audit-repository';
import { createPostgresObservationRepository } from './modules/measurements/observation-repository';
import { createPostgresTimelineRepository } from './modules/timeline/timeline-repository';
import { createPostgresConsultationReportRepository } from './modules/consultation/consultation-report-repository';
import { createPostgresPrivacyRequestRepository } from './modules/privacy/privacy-request-repository';
import { createPostgresShareGrantRepository } from './modules/sharing/share-grant-repository';
import { createPostgresOutputContestationRepository } from './modules/feedback/output-contestation-repository';
import { createPostgresSupportRequestRepository } from './modules/support/support-request-repository';
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    statement_timeout: 2000,
    query_timeout: 2500,
    application_name: 'glucora-api',
  });
  // Pool errors must not emit raw connection details or terminate the process.
  pool.on('error', () => {});
  const users = createPostgresUserAccountRepository(pool);
  const consents = createPostgresConsentRepository(pool);
  const consentPurposes = createPostgresConsentPurposeRepository(pool);
  const consentDecisions = createPostgresConsentDecisionRecorder(pool);
  const audit = createPostgresAuditRepository(pool);
  const observations = createPostgresObservationRepository(pool);
  const timeline = createPostgresTimelineRepository(pool);
  const consultationReports = createPostgresConsultationReportRepository(pool);
  const privacyRequests = createPostgresPrivacyRequestRepository(pool);
  const shareGrants = createPostgresShareGrantRepository(pool);
  const outputContestations = createPostgresOutputContestationRepository(pool);
  const supportRequests = createPostgresSupportRequestRepository(pool);
  return {
    async checkReadiness() {
      const result = await pool.query<{ version: string }>(
        "SELECT version FROM glucora_meta.schema_migrations WHERE version = '0001_foundation'",
      );
      if (result.rowCount !== 1) throw new Error('Schema not ready');
    },
    close: () => pool.end(),
    users,
    consents,
    consentPurposes,
    consentDecisions,
    audit,
    observations,
    timeline,
    consultationReports,
    privacyRequests,
    shareGrants,
    outputContestations,
    supportRequests,
  };
}
