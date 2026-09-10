CREATE SCHEMA support;
REVOKE ALL ON SCHEMA support FROM PUBLIC;
CREATE TABLE support.requests (
  id text PRIMARY KEY CHECK (id ~ '^sup_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  category text NOT NULL CHECK (category IN ('account_access','privacy_rights','data_quality','sharing','unsafe_output','technical_issue')),
  status text NOT NULL CHECK (status = 'submitted'),
  created_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  UNIQUE (user_id,idempotency_key),
  CHECK (created_at <= recorded_at + interval '5 minutes')
);
CREATE INDEX support_requests_user_time ON support.requests (user_id,created_at DESC,id DESC);
CREATE FUNCTION support.reject_request_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'support requests are append-only' USING ERRCODE = '55000'; END;
$$;
CREATE TRIGGER support_requests_no_mutation BEFORE UPDATE OR DELETE ON support.requests
  FOR EACH ROW EXECUTE FUNCTION support.reject_request_mutation();
COMMENT ON TABLE support.requests IS 'Consumer-created support entry point with controlled category and no free-text or health payload.';
