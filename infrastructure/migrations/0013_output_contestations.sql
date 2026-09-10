CREATE TABLE privacy.output_contestations (
  id text PRIMARY KEY CHECK (id ~ '^fbk_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  resource_type text NOT NULL CHECK (resource_type IN ('ai_output','consultation_report')),
  resource_id text NOT NULL CHECK (resource_id ~ '^[A-Za-z]{3}_[A-Za-z0-9_-]{16,64}$'),
  resource_version text NOT NULL CHECK (length(resource_version) BETWEEN 1 AND 128),
  reason text NOT NULL CHECK (reason IN ('inaccurate','unsafe','irrelevant','missing_context','unclear')),
  status text NOT NULL CHECK (status='open'), occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,resource_type,resource_id,resource_version),
  CHECK (occurred_at <= recorded_at + interval '5 minutes')
);
CREATE INDEX output_contestations_open_lookup ON privacy.output_contestations (user_id,resource_type,resource_id) WHERE status='open';
CREATE TRIGGER output_contestations_no_mutation BEFORE UPDATE OR DELETE ON privacy.output_contestations
  FOR EACH ROW EXECUTE FUNCTION privacy.reject_event_mutation();
COMMENT ON TABLE privacy.output_contestations IS 'Append-only controlled feedback; raw output and free text are intentionally excluded.';
