-- ADR-044: a receipt must never be attached to another holder's request.
CREATE FUNCTION privacy.guard_deletion_receipt_ownership() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM privacy.requests
    WHERE id = NEW.request_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'deletion receipt subject does not own request' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER deletion_target_receipts_owner_match
  BEFORE INSERT ON privacy.deletion_target_receipts
  FOR EACH ROW EXECUTE FUNCTION privacy.guard_deletion_receipt_ownership();
