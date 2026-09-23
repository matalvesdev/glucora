-- ADR-054: idempotency evidence for corrections without duplicating health values.
CREATE TABLE health.manual_observation_corrections (
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  observation_id text NOT NULL,
  observation_version integer NOT NULL CHECK (observation_version > 1),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, idempotency_key),
  UNIQUE (observation_id, observation_version),
  FOREIGN KEY (observation_id, observation_version)
    REFERENCES health.observations(id, version)
);

CREATE FUNCTION health.reject_manual_correction_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('glucora.canonical_deletion_request', true) IS NOT NULL THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'manual observation corrections are append-only' USING ERRCODE='55000';
END;
$$;

CREATE TRIGGER manual_observation_corrections_no_mutation
  BEFORE UPDATE OR DELETE ON health.manual_observation_corrections
  FOR EACH ROW EXECUTE FUNCTION health.reject_manual_correction_mutation();

CREATE OR REPLACE FUNCTION privacy.delete_canonical_health_data(p_request_id text, p_user_id text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE request_kind text; request_status text;
BEGIN
  SELECT kind,status INTO request_kind,request_status FROM privacy.requests WHERE id=p_request_id AND user_id=p_user_id FOR UPDATE;
  IF request_kind IS DISTINCT FROM 'deletion' OR request_status IS DISTINCT FROM 'in_review' THEN RAISE EXCEPTION 'Deletion request is not eligible' USING ERRCODE='55000'; END IF;
  PERFORM set_config('glucora.canonical_deletion_request', p_request_id, true);
  DELETE FROM timeline.items WHERE user_id=p_user_id; DELETE FROM health.context_events WHERE user_id=p_user_id;
  DELETE FROM health.manual_observation_corrections WHERE user_id=p_user_id; DELETE FROM health.manual_observation_captures WHERE user_id=p_user_id;
  DELETE FROM health.observations WHERE user_id=p_user_id; DELETE FROM health.provenance_records WHERE user_id=p_user_id; DELETE FROM consent.events WHERE user_id=p_user_id;
END;
$$;
