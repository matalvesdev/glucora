-- ADR-062: minimal export generation and client-receipt evidence.
CREATE TABLE privacy.export_delivery_receipts (
  id text PRIMARY KEY CHECK (id ~ '^exp_[A-Za-z0-9_-]{16,64}$'),
  request_id text NOT NULL REFERENCES privacy.requests(id),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  record_count integer NOT NULL CHECK (record_count >= 0),
  status text NOT NULL CHECK (status IN ('generated','acknowledged')) DEFAULT 'generated',
  generated_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  CHECK ((status='generated' AND acknowledged_at IS NULL) OR
         (status='acknowledged' AND acknowledged_at IS NOT NULL AND acknowledged_at >= generated_at))
);

CREATE INDEX export_delivery_request_time
  ON privacy.export_delivery_receipts (request_id, generated_at DESC, id DESC);

CREATE FUNCTION privacy.guard_export_delivery_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' AND NOT EXISTS (
    SELECT 1 FROM privacy.requests
     WHERE id=NEW.request_id AND user_id=NEW.user_id AND kind='export' AND status='in_review'
  ) THEN
    RAISE EXCEPTION 'invalid export delivery owner or request state' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='generated' AND NEW.status='acknowledged'
     AND NEW.acknowledged_at IS NOT NULL
     AND NEW.id=OLD.id AND NEW.request_id=OLD.request_id AND NEW.user_id=OLD.user_id
     AND NEW.sha256=OLD.sha256 AND NEW.record_count=OLD.record_count
     AND NEW.generated_at=OLD.generated_at THEN RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'invalid export delivery receipt mutation' USING ERRCODE='55000';
END;
$$;

CREATE TRIGGER guard_export_delivery_receipt
  BEFORE INSERT OR UPDATE OR DELETE ON privacy.export_delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION privacy.guard_export_delivery_receipt();

COMMENT ON TABLE privacy.export_delivery_receipts IS
  'Minimal checksum evidence for generated and client-acknowledged owned exports; contains no export payload.';
