import type {
  DataExportRecord,
  DataExportSectionPort,
  JsonValue,
} from '@glucora/domain';

interface Queryable {
  query<T extends Record<string, unknown>>(
    text: string,
    values: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[] }>;
}

function json(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid export value');
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(json);
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        json(item),
      ]),
    );
  throw new Error('Invalid export value');
}

function record(input: {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly version: string | number;
  readonly provenanceRefs?: readonly string[];
  readonly data: Record<string, unknown>;
}): DataExportRecord {
  return {
    id: input.id,
    subjectUserId: input.userId,
    resourceType: input.type,
    resourceVersion: String(input.version),
    provenanceRefs: input.provenanceRefs ?? [],
    data: json(input.data) as { readonly [key: string]: JsonValue },
  };
}

function section(
  sectionId: string,
  load: (userId: string) => Promise<readonly DataExportRecord[]>,
): DataExportSectionPort {
  return {
    sectionId,
    async loadForSubject(userId) {
      return { sectionId, records: await load(userId) };
    },
  };
}

export function createPostgresExportSections(
  database: Queryable,
): readonly DataExportSectionPort[] {
  return [
    section('account', async (userId) => {
      const { rows } = await database.query<{
        id: string;
        status: string;
        locale: string;
        timezone: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id,status,locale,timezone,created_at,updated_at
           FROM identity.user_accounts WHERE id=$1`,
        [userId],
      );
      return rows.map((row) =>
        record({
          id: row.id,
          userId,
          type: 'account',
          version: row.updated_at.toISOString(),
          data: row,
        }),
      );
    }),
    section('consents', async (userId) => {
      const { rows } = await database.query<
        Record<string, unknown> & {
          id: string;
          purpose_version_id: string;
        }
      >(
        `SELECT e.id,e.purpose_version_id,p.purpose_key,p.version AS purpose_version,
                p.title,p.notice_text,p.legal_basis_ref,p.retention_policy_ref,
                e.event_type,e.channel,e.occurred_at,e.recorded_at
           FROM consent.events e
           JOIN consent.purpose_versions p ON p.id=e.purpose_version_id
          WHERE e.user_id=$1 ORDER BY e.occurred_at,e.recorded_at,e.id`,
        [userId],
      );
      return rows.map((row) =>
        record({
          id: row.id,
          userId,
          type: 'consent_event',
          version: String(row.purpose_version_id),
          data: row,
        }),
      );
    }),
    section('observations', async (userId) => {
      const { rows } = await database.query<
        Record<string, unknown> & {
          id: string;
          version: number;
          provenance_id: string;
        }
      >(
        `SELECT o.id,o.version,o.type_system,o.type_code,o.decimal_value::text,
                o.unit_system,o.unit_code,o.occurred_at,o.recorded_at,o.ingested_at,
                o.source_type,o.source_id,o.provenance_id,o.fact_class,o.status,
                o.superseded_at,o.created_at,p.method_code,p.transformation_ref
           FROM health.observations o
           JOIN health.provenance_records p ON p.id=o.provenance_id AND p.user_id=o.user_id
          WHERE o.user_id=$1 ORDER BY o.occurred_at,o.id,o.version`,
        [userId],
      );
      return rows.map((row) =>
        record({
          id: row.id,
          userId,
          type: 'observation',
          version: row.version,
          provenanceRefs: [row.provenance_id],
          data: row,
        }),
      );
    }),
    section('consultation_reports', async (userId) => {
      const { rows } = await database.query<
        Record<string, unknown> & {
          id: string;
          created_at: Date;
          source_refs: unknown;
        }
      >(
        `SELECT r.id,r.period_from,r.period_to,r.generated_at,r.total_records,
                r.counts_by_category,r.counts_by_source_type,r.limitations,r.created_at,
                COALESCE(jsonb_agg(jsonb_build_object('timelineItemId',s.timeline_item_id,
                  'sourceVersion',s.source_version) ORDER BY s.timeline_item_id)
                  FILTER (WHERE s.timeline_item_id IS NOT NULL),'[]'::jsonb) AS source_refs
           FROM consultation.reports r
           LEFT JOIN consultation.report_sources s ON s.report_id=r.id
          WHERE r.user_id=$1 GROUP BY r.id ORDER BY r.created_at,r.id`,
        [userId],
      );
      return rows.map((row) =>
        record({
          id: row.id,
          userId,
          type: 'consultation_report',
          version: row.created_at.toISOString(),
          provenanceRefs: Array.isArray(row.source_refs)
            ? row.source_refs.flatMap((item) =>
                typeof item === 'object' && item && 'timelineItemId' in item
                  ? [String(item.timelineItemId)]
                  : [],
              )
            : [],
          data: row,
        }),
      );
    }),
    section('privacy_requests', async (userId) => {
      const { rows } = await database.query<
        Record<string, unknown> & {
          id: string;
          version: number;
        }
      >(
        `SELECT id,kind,scope,status,version,requested_at,updated_at
           FROM privacy.requests WHERE user_id=$1 ORDER BY requested_at,id`,
        [userId],
      );
      return rows.map((row) =>
        record({
          id: row.id,
          userId,
          type: 'privacy_request',
          version: row.version,
          data: row,
        }),
      );
    }),
  ];
}
