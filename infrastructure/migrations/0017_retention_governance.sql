-- ADR-044: opaque, append-only evidence for legal holds and deletion targets.
CREATE TABLE privacy.retention_hold_events (
  id text PRIMARY KEY CHECK (id ~ '^rhe_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  hold_ref text NOT NULL CHECK (hold_ref ~ '^[A-Za-z0-9:_-]{8,128}$'),
  event_type text NOT NULL CHECK (event_type IN ('applied','released')),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  responsible_ref text NOT NULL CHECK (responsible_ref ~ '^[A-Za-z0-9:_-]{3,128}$'),
  evidence_ref text NOT NULL CHECK (evidence_ref ~ '^[A-Za-z0-9:_-]{8,256}$'),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (occurred_at <= recorded_at + interval '5 minutes')
);
CREATE INDEX retention_hold_events_user_ref_time ON privacy.retention_hold_events (user_id, hold_ref, occurred_at DESC, id DESC);
CREATE FUNCTION privacy.reject_retention_hold_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'retention hold events are append-only' USING ERRCODE = '55000'; END; $$;
CREATE TRIGGER retention_hold_events_no_mutation BEFORE UPDATE OR DELETE ON privacy.retention_hold_events FOR EACH ROW EXECUTE FUNCTION privacy.reject_retention_hold_event_mutation();

CREATE TABLE privacy.deletion_target_receipts (
  id text PRIMARY KEY CHECK (id ~ '^drc_[A-Za-z0-9_-]{16,64}$'),
  request_id text NOT NULL REFERENCES privacy.requests(id),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  target_id text NOT NULL CHECK (target_id ~ '^[a-z][a-z0-9_]{2,63}$'),
  target_class text NOT NULL CHECK (target_class IN ('canonical','projection','vendor','backup')),
  outcome text NOT NULL CHECK (outcome IN ('deleted','retained','pending','failed')),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  evidence_ref text CHECK (evidence_ref IS NULL OR evidence_ref ~ '^[A-Za-z0-9:_-]{8,256}$'),
  recorded_at timestamptz NOT NULL,
  CHECK ((outcome = 'failed' AND evidence_ref IS NULL) OR (outcome <> 'failed' AND evidence_ref IS NOT NULL))
);
CREATE INDEX deletion_target_receipts_request_time ON privacy.deletion_target_receipts (request_id, recorded_at DESC, id DESC);
CREATE FUNCTION privacy.reject_deletion_target_receipt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'deletion target receipts are append-only' USING ERRCODE = '55000'; END; $$;
CREATE TRIGGER deletion_target_receipts_no_mutation BEFORE UPDATE OR DELETE ON privacy.deletion_target_receipts FOR EACH ROW EXECUTE FUNCTION privacy.reject_deletion_target_receipt_mutation();

COMMENT ON TABLE privacy.retention_hold_events IS 'ADR-044 legal-hold ledger; controlled codes and opaque references only.';
COMMENT ON TABLE privacy.deletion_target_receipts IS 'ADR-044 deletion target evidence; no health payload or record counts.';
