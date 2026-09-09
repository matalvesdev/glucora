CREATE SCHEMA sharing;
REVOKE ALL ON SCHEMA sharing FROM PUBLIC;
CREATE TABLE sharing.grants (
  id text PRIMARY KEY CHECK (id ~ '^shr_[A-Za-z0-9_-]{16,64}$'),
  owner_user_id text NOT NULL REFERENCES identity.user_accounts(id),
  recipient_ref text NOT NULL CHECK (recipient_ref ~ '^rcp_[A-Za-z0-9_-]{16,64}$'),
  resource_type text NOT NULL CHECK (resource_type = 'consultation_report'),
  resource_id text NOT NULL REFERENCES consultation.reports(id),
  purpose_version_id text NOT NULL REFERENCES consent.purpose_versions(id),
  status text NOT NULL CHECK (status IN ('active','revoked')), version integer NOT NULL CHECK (version > 0),
  granted_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  CHECK (granted_at < expires_at),
  CHECK ((status='active' AND revoked_at IS NULL) OR (status='revoked' AND revoked_at IS NOT NULL AND revoked_at >= granted_at)),
  UNIQUE (id, owner_user_id)
);
CREATE INDEX share_grants_owner_status ON sharing.grants (owner_user_id, status, expires_at);
CREATE FUNCTION sharing.guard_grant_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='active' AND NEW.status='revoked' AND NEW.version=OLD.version+1 AND NEW.revoked_at IS NOT NULL
     AND NEW.id=OLD.id AND NEW.owner_user_id=OLD.owner_user_id AND NEW.recipient_ref=OLD.recipient_ref
     AND NEW.resource_type=OLD.resource_type AND NEW.resource_id=OLD.resource_id
     AND NEW.purpose_version_id=OLD.purpose_version_id AND NEW.granted_at=OLD.granted_at AND NEW.expires_at=OLD.expires_at THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid share grant mutation' USING ERRCODE='55000';
END;
$$;
CREATE TRIGGER guard_grant_mutation BEFORE UPDATE OR DELETE ON sharing.grants FOR EACH ROW EXECUTE FUNCTION sharing.guard_grant_mutation();
COMMENT ON TABLE sharing.grants IS 'Explicit, expiring grant for one artifact and one opaque recipient reference.';
