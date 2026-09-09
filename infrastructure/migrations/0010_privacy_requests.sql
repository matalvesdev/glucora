CREATE SCHEMA privacy;
REVOKE ALL ON SCHEMA privacy FROM PUBLIC;
CREATE TABLE privacy.requests (
  id text PRIMARY KEY CHECK (id ~ '^dsr_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  kind text NOT NULL CHECK (kind IN ('access', 'export', 'deletion')),
  scope text NOT NULL CHECK (scope = 'all_user_data'),
  status text NOT NULL CHECK (status IN ('requested','identity_verification_required','in_review','fulfilled','partially_fulfilled','denied','cancelled')),
  version integer NOT NULL CHECK (version > 0), requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL, idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'), UNIQUE (user_id, idempotency_key),
  CHECK (requested_at <= updated_at)
);
CREATE TABLE privacy.request_events (
  id text PRIMARY KEY CHECK (id ~ '^dse_[A-Za-z0-9_-]{16,64}$'),
  request_id text NOT NULL REFERENCES privacy.requests(id), user_id text NOT NULL REFERENCES identity.user_accounts(id),
  from_status text, to_status text NOT NULL, reason_code text NOT NULL CHECK (reason_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_status IS NULL OR from_status IN ('requested','identity_verification_required','in_review','fulfilled','partially_fulfilled','denied','cancelled')),
  CHECK (to_status IN ('requested','identity_verification_required','in_review','fulfilled','partially_fulfilled','denied','cancelled')),
  CHECK (occurred_at <= recorded_at + interval '5 minutes')
);
CREATE INDEX privacy_requests_user_time ON privacy.requests (user_id, requested_at DESC, id DESC);
CREATE INDEX privacy_request_events_history ON privacy.request_events (request_id, occurred_at, id);
CREATE FUNCTION privacy.reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'privacy request events are append-only' USING ERRCODE = '55000'; END; $$;
CREATE TRIGGER request_events_no_mutation BEFORE UPDATE OR DELETE ON privacy.request_events FOR EACH ROW EXECUTE FUNCTION privacy.reject_event_mutation();
COMMENT ON TABLE privacy.requests IS 'Tracked data-subject request state; deadlines are assigned only by approved Compliance policy.';
