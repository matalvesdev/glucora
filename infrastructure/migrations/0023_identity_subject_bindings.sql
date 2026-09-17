-- ADR-051: immutable provider subject to internal consumer mapping.
CREATE TABLE identity.subject_bindings (
  provider text NOT NULL CHECK (provider IN ('identity_platform')),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 128),
  user_id text NOT NULL REFERENCES identity.user_accounts(id) ON DELETE RESTRICT,
  bound_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject),
  UNIQUE (provider, user_id)
);

CREATE FUNCTION identity.reject_subject_binding_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'identity subject bindings are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER identity_subject_bindings_no_update
  BEFORE UPDATE ON identity.subject_bindings
  FOR EACH ROW EXECUTE FUNCTION identity.reject_subject_binding_mutation();

CREATE TRIGGER identity_subject_bindings_no_delete
  BEFORE DELETE ON identity.subject_bindings
  FOR EACH ROW EXECUTE FUNCTION identity.reject_subject_binding_mutation();

COMMENT ON TABLE identity.subject_bindings IS 'Immutable external identity subject mapping; no credentials or health data.';
