-- B2: minimal first-party account/profile record. Authentication credentials stay with the future identity provider.
CREATE SCHEMA identity;
REVOKE ALL ON SCHEMA identity FROM PUBLIC;

CREATE TABLE identity.user_accounts (
  id text PRIMARY KEY CHECK (id ~ '^usr_[A-Za-z0-9_-]{16,64}$'),
  status text NOT NULL CHECK (status IN ('active', 'disabled')) DEFAULT 'active',
  locale text NOT NULL CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$') DEFAULT 'pt-BR',
  timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 64) DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (created_at <= updated_at)
);

COMMENT ON TABLE identity.user_accounts IS 'Minimal application account mapped to an external identity; contains no credentials or health data.';
