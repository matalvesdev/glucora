-- B4/B5 foundation: versioned purposes and append-only consent evidence.
-- This migration intentionally seeds no purpose or legal basis.
CREATE SCHEMA consent;
REVOKE ALL ON SCHEMA consent FROM PUBLIC;

CREATE TABLE consent.purpose_versions (
  id text PRIMARY KEY CHECK (id ~ '^pur_[A-Za-z0-9_-]{16,64}$'),
  purpose_key text NOT NULL CHECK (purpose_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'retired')) DEFAULT 'draft',
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  notice_text text NOT NULL CHECK (length(notice_text) BETWEEN 1 AND 4000),
  legal_basis_ref text NOT NULL CHECK (length(legal_basis_ref) BETWEEN 1 AND 200),
  retention_policy_ref text NOT NULL CHECK (length(retention_policy_ref) BETWEEN 1 AND 200),
  owner_ref text NOT NULL CHECK (length(owner_ref) BETWEEN 1 AND 200),
  effective_from timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purpose_key, version),
  CHECK ((status = 'draft' AND effective_from IS NULL AND retired_at IS NULL)
    OR (status = 'published' AND effective_from IS NOT NULL AND retired_at IS NULL)
    OR (status = 'retired' AND effective_from IS NOT NULL AND retired_at IS NOT NULL)),
  CHECK (retired_at IS NULL OR retired_at >= effective_from)
);

CREATE UNIQUE INDEX one_published_version_per_purpose
  ON consent.purpose_versions (purpose_key) WHERE status = 'published';

CREATE FUNCTION consent.guard_purpose_version_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'published purpose versions cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.purpose_key IS DISTINCT FROM OLD.purpose_key OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.notice_text IS DISTINCT FROM OLD.notice_text OR
    NEW.legal_basis_ref IS DISTINCT FROM OLD.legal_basis_ref OR
    NEW.retention_policy_ref IS DISTINCT FROM OLD.retention_policy_ref OR
    NEW.owner_ref IS DISTINCT FROM OLD.owner_ref OR
    NEW.effective_from IS DISTINCT FROM OLD.effective_from OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'published purpose version content is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER guard_purpose_version_mutation
  BEFORE UPDATE OR DELETE ON consent.purpose_versions
  FOR EACH ROW EXECUTE FUNCTION consent.guard_purpose_version_mutation();

CREATE TABLE consent.events (
  id text PRIMARY KEY CHECK (id ~ '^cne_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  purpose_version_id text NOT NULL REFERENCES consent.purpose_versions(id),
  event_type text NOT NULL CHECK (event_type IN ('granted', 'denied', 'revoked')),
  channel text NOT NULL CHECK (length(channel) BETWEEN 1 AND 64),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, purpose_version_id, idempotency_key),
  CHECK (occurred_at <= recorded_at + interval '5 minutes')
);

CREATE INDEX consent_events_history
  ON consent.events (user_id, purpose_version_id, occurred_at DESC, recorded_at DESC);

CREATE FUNCTION consent.guard_event_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE purpose_status text;
DECLARE purpose_effective_from timestamptz;
BEGIN
  SELECT status, effective_from INTO purpose_status, purpose_effective_from
  FROM consent.purpose_versions WHERE id = NEW.purpose_version_id;
  IF NEW.event_type = 'granted'
     AND (purpose_status <> 'published' OR purpose_effective_from > NEW.occurred_at) THEN
    RAISE EXCEPTION 'consent purpose is not active' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_consent_event_insert
  BEFORE INSERT ON consent.events
  FOR EACH ROW EXECUTE FUNCTION consent.guard_event_insert();

CREATE FUNCTION consent.reject_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'consent events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER consent_events_no_update
  BEFORE UPDATE ON consent.events
  FOR EACH ROW EXECUTE FUNCTION consent.reject_event_mutation();

CREATE TRIGGER consent_events_no_delete
  BEFORE DELETE ON consent.events
  FOR EACH ROW EXECUTE FUNCTION consent.reject_event_mutation();

COMMENT ON TABLE consent.purpose_versions IS 'Compliance-approved, user-facing purpose text by immutable version; contains no user health data.';
COMMENT ON TABLE consent.events IS 'Append-only evidence of a user consent decision; current state is reconstructed from event order.';
