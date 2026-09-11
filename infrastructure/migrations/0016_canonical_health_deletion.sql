-- ADR-043: controlled exception to append-only health history for an approved deletion request.
CREATE FUNCTION privacy.delete_canonical_health_data(p_request_id text, p_user_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE request_kind text;
DECLARE request_status text;
BEGIN
  SELECT kind,status INTO request_kind,request_status FROM privacy.requests
  WHERE id=p_request_id AND user_id=p_user_id FOR UPDATE;
  IF request_kind IS DISTINCT FROM 'deletion' OR request_status IS DISTINCT FROM 'in_review' THEN
    RAISE EXCEPTION 'Deletion request is not eligible' USING ERRCODE='55000';
  END IF;
  PERFORM set_config('glucora.canonical_deletion_request', p_request_id, true);
  DELETE FROM timeline.items WHERE user_id=p_user_id;
  DELETE FROM health.context_events WHERE user_id=p_user_id;
  DELETE FROM health.observations WHERE user_id=p_user_id;
  DELETE FROM health.provenance_records WHERE user_id=p_user_id;
  DELETE FROM consent.events WHERE user_id=p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION health.reject_provenance_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('glucora.canonical_deletion_request', true) IS NOT NULL THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'provenance records are append-only' USING ERRCODE = '55000';
END;
$$;
CREATE OR REPLACE FUNCTION health.guard_observation_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('glucora.canonical_deletion_request', true) IS NOT NULL THEN RETURN OLD; END IF;
  IF OLD.status = 'current' AND NEW.status = 'superseded' AND NEW.superseded_at IS NOT NULL
     AND NEW.id=OLD.id AND NEW.version=OLD.version AND NEW.user_id=OLD.user_id
     AND NEW.type_system=OLD.type_system AND NEW.type_code=OLD.type_code AND NEW.decimal_value=OLD.decimal_value
     AND NEW.unit_system=OLD.unit_system AND NEW.unit_code=OLD.unit_code AND NEW.occurred_at=OLD.occurred_at
     AND NEW.recorded_at=OLD.recorded_at AND NEW.ingested_at=OLD.ingested_at AND NEW.source_type=OLD.source_type
     AND NEW.source_id=OLD.source_id AND NEW.provenance_id=OLD.provenance_id AND NEW.fact_class=OLD.fact_class AND NEW.created_at=OLD.created_at THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'observation history is immutable' USING ERRCODE = '55000';
END;
$$;
CREATE OR REPLACE FUNCTION health.reject_context_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('glucora.canonical_deletion_request', true) IS NOT NULL THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'context event history is immutable' USING ERRCODE = '55000';
END;
$$;
CREATE OR REPLACE FUNCTION consent.reject_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('glucora.canonical_deletion_request', true) IS NOT NULL THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'consent events are append-only' USING ERRCODE = '55000';
END;
$$;
