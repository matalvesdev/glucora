-- ADR-056: append-only controlled consultation question selections.
CREATE TABLE consultation.report_question_events (
  id text PRIMARY KEY CHECK (id ~ '^rqe_[A-Za-z0-9_-]{16,64}$'),
  report_id text NOT NULL REFERENCES consultation.reports(id),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  question_key text NOT NULL CHECK (question_key IN ('review_records','discuss_routine','clarify_next_steps')),
  action text NOT NULL CHECK (action IN ('added','removed')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL CHECK (version > 0),
  occurred_at timestamptz NOT NULL,
  UNIQUE (user_id, idempotency_key),
  UNIQUE (report_id, question_key, version)
);

CREATE FUNCTION consultation.reject_report_question_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'consultation question events are append-only' USING ERRCODE='55000'; END; $$;
CREATE TRIGGER report_question_events_no_mutation BEFORE UPDATE OR DELETE ON consultation.report_question_events FOR EACH ROW EXECUTE FUNCTION consultation.reject_report_question_event_mutation();
