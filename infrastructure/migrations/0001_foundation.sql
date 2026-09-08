-- Initiative A baseline: operational metadata only, no patient data.
CREATE SCHEMA glucora_meta;
REVOKE ALL ON SCHEMA glucora_meta FROM PUBLIC;
CREATE TABLE glucora_meta.schema_migrations (
 version text PRIMARY KEY,
 checksum text NOT NULL CHECK (length(checksum) = 64),
 applied_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE glucora_meta.schema_migrations IS 'Immutable migration ledger; not a clinical record.';

