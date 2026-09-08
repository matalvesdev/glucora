-- B7 foundation: append-only audit evidence, separate from operational logs.
-- Free-form payloads are intentionally excluded to reduce sensitive-data exposure.
CREATE SCHEMA audit;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;

CREATE TABLE audit.events (
  id text PRIMARY KEY CHECK (id ~ '^aud_[A-Za-z0-9_-]{16,64}$'),
  event_key text NOT NULL CHECK (event_key ~ '^[a-z][a-z0-9_.]{2,95}$'),
  actor_type text NOT NULL CHECK (actor_type IN ('consumer', 'system')),
  actor_id text CHECK (actor_id IS NULL OR actor_id ~ '^[A-Za-z]{3}_[A-Za-z0-9_-]{16,64}$'),
  subject_id text CHECK (subject_id IS NULL OR subject_id ~ '^[A-Za-z]{3}_[A-Za-z0-9_-]{16,64}$'),
  resource_type text NOT NULL CHECK (resource_type ~ '^[a-z][a-z0-9_]{2,63}$'),
  resource_id text NOT NULL CHECK (resource_id ~ '^[A-Za-z]{3}_[A-Za-z0-9_-]{16,64}$'),
  action text NOT NULL CHECK (action ~ '^[a-z][a-z0-9_]{2,63}$'),
  outcome text NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  request_id uuid,
  retention_policy_ref text NOT NULL CHECK (length(retention_policy_ref) BETWEEN 1 AND 200),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((actor_type = 'consumer' AND actor_id IS NOT NULL) OR actor_type = 'system'),
  CHECK (occurred_at <= recorded_at + interval '5 minutes')
);

CREATE INDEX audit_events_subject_history
  ON audit.events (subject_id, occurred_at DESC, recorded_at DESC)
  WHERE subject_id IS NOT NULL;

CREATE INDEX audit_events_resource_history
  ON audit.events (resource_type, resource_id, occurred_at DESC, recorded_at DESC);

CREATE FUNCTION audit.reject_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit.events
  FOR EACH ROW EXECUTE FUNCTION audit.reject_event_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit.events
  FOR EACH ROW EXECUTE FUNCTION audit.reject_event_mutation();

COMMENT ON TABLE audit.events IS 'Minimal append-only audit evidence; raw clinical and free-form request payloads are prohibited by schema design.';
