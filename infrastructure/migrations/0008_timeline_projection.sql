CREATE SCHEMA timeline;
REVOKE ALL ON SCHEMA timeline FROM PUBLIC;

CREATE TABLE timeline.items (
  id text PRIMARY KEY CHECK (id ~ '^tli_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  source_kind text NOT NULL CHECK (source_kind IN ('observation', 'context_event')),
  source_id text NOT NULL,
  source_version integer NOT NULL CHECK (source_version > 0),
  category_system text NOT NULL,
  category_code text NOT NULL,
  fact_class text NOT NULL CHECK (fact_class IN ('fact', 'declaration', 'derivation', 'clinical_assertion')),
  source_type text NOT NULL CHECK (source_type IN ('manual', 'imported', 'derived')),
  occurred_at timestamptz NOT NULL,
  observed_timezone text NOT NULL,
  utc_offset_minutes smallint NOT NULL,
  projected_at timestamptz NOT NULL,
  UNIQUE (user_id, source_kind, source_id, source_version)
);
CREATE INDEX timeline_items_user_time ON timeline.items (user_id, occurred_at DESC, id DESC);
COMMENT ON TABLE timeline.items IS 'Disposable projection. Canonical health records remain authoritative.';
