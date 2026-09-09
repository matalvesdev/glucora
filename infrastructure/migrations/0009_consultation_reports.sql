CREATE SCHEMA consultation;
REVOKE ALL ON SCHEMA consultation FROM PUBLIC;
CREATE TABLE consultation.reports (
  id text PRIMARY KEY CHECK (id ~ '^rpt_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  period_from timestamptz NOT NULL, period_to timestamptz NOT NULL,
  generated_at timestamptz NOT NULL, total_records integer NOT NULL CHECK (total_records >= 0),
  counts_by_category jsonb NOT NULL CHECK (jsonb_typeof(counts_by_category) = 'object'),
  counts_by_source_type jsonb NOT NULL CHECK (jsonb_typeof(counts_by_source_type) = 'object'),
  limitations text[] NOT NULL CHECK (cardinality(limitations) >= 3),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL, UNIQUE (user_id, idempotency_key),
  CHECK (period_from < period_to AND period_to <= generated_at AND generated_at <= created_at)
);
CREATE TABLE consultation.report_sources (
  report_id text NOT NULL REFERENCES consultation.reports(id),
  timeline_item_id text NOT NULL, source_version integer NOT NULL CHECK (source_version > 0),
  PRIMARY KEY (report_id, timeline_item_id)
);
CREATE INDEX consultation_reports_user_time ON consultation.reports (user_id, created_at DESC, id DESC);
CREATE FUNCTION consultation.reject_report_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'consultation reports are immutable' USING ERRCODE = '55000'; END;
$$;
CREATE TRIGGER reports_no_mutation BEFORE UPDATE OR DELETE ON consultation.reports FOR EACH ROW EXECUTE FUNCTION consultation.reject_report_mutation();
CREATE TRIGGER report_sources_no_mutation BEFORE UPDATE OR DELETE ON consultation.report_sources FOR EACH ROW EXECUTE FUNCTION consultation.reject_report_mutation();
COMMENT ON TABLE consultation.reports IS 'Immutable deterministic report snapshot; not a clinical recommendation.';
