CREATE FUNCTION privacy.guard_request_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.kind <> OLD.kind
     OR NEW.scope <> OLD.scope OR NEW.requested_at <> OLD.requested_at
     OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.request_hash <> OLD.request_hash
     OR NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'privacy request immutable fields or version violated' USING ERRCODE = '55000';
  END IF;
  IF NOT (
    (OLD.status = 'requested' AND NEW.status IN ('identity_verification_required','in_review','cancelled')) OR
    (OLD.status = 'identity_verification_required' AND NEW.status IN ('in_review','denied','cancelled')) OR
    (OLD.status = 'in_review' AND NEW.status IN ('fulfilled','partially_fulfilled','denied','cancelled'))
  ) THEN
    RAISE EXCEPTION 'invalid privacy request transition' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_request_transition BEFORE UPDATE ON privacy.requests
  FOR EACH ROW EXECUTE FUNCTION privacy.guard_request_transition();
CREATE FUNCTION privacy.reject_request_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'privacy requests cannot be deleted directly' USING ERRCODE = '55000'; END;
$$;
CREATE TRIGGER requests_no_delete BEFORE DELETE ON privacy.requests
  FOR EACH ROW EXECUTE FUNCTION privacy.reject_request_delete();
