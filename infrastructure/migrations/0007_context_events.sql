-- C3 foundation. Category availability remains controlled by an application catalog.
CREATE TABLE health.context_events (
  id text NOT NULL CHECK (id ~ '^ctx_[A-Za-z0-9_-]{16,64}$'),
  version integer NOT NULL CHECK (version > 0),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  category_system text NOT NULL CHECK (category_system ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  category_code text NOT NULL CHECK (category_code ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  note text CHECK (note IS NULL OR (length(note) BETWEEN 1 AND 500 AND note = btrim(note))),
  occurred_at timestamptz NOT NULL,
  observed_timezone text NOT NULL,
  utc_offset_minutes smallint NOT NULL CHECK (utc_offset_minutes BETWEEN -840 AND 840),
  recorded_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual', 'imported')),
  source_id text NOT NULL CHECK (source_id ~ '^[a-z]{3}_[A-Za-z0-9_-]{16,64}$'),
  provenance_id text NOT NULL,
  fact_class text NOT NULL CHECK (fact_class IN ('fact', 'declaration', 'clinical_assertion')),
  status text NOT NULL CHECK (status IN ('current', 'superseded', 'entered_in_error')),
  superseded_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id, version),
  FOREIGN KEY (provenance_id, user_id) REFERENCES health.provenance_records(id, user_id),
  CHECK (occurred_at <= recorded_at AND recorded_at <= ingested_at AND ingested_at <= created_at),
  CHECK ((status = 'current' AND superseded_at IS NULL) OR (status <> 'current' AND superseded_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_current_context_event_version ON health.context_events (id) WHERE status = 'current';
CREATE INDEX context_events_user_time ON health.context_events (user_id, occurred_at DESC, id, version DESC);
CREATE FUNCTION health.reject_context_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'context event history is immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER context_events_no_mutation BEFORE UPDATE OR DELETE ON health.context_events
  FOR EACH ROW EXECUTE FUNCTION health.reject_context_event_mutation();
COMMENT ON TABLE health.context_events IS 'Canonical contextual declarations; category semantics are supplied by an approved catalog.';
