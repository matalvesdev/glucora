-- C2/C4 persistence foundation. No clinical catalog or production capture is enabled.
CREATE SCHEMA health;
REVOKE ALL ON SCHEMA health FROM PUBLIC;

CREATE TABLE health.provenance_records (
  id text PRIMARY KEY CHECK (id ~ '^prv_[A-Za-z0-9_-]{16,64}$'),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  source_type text NOT NULL CHECK (source_type IN ('manual', 'imported', 'derived')),
  source_id text NOT NULL CHECK (source_id ~ '^[a-z]{3}_[A-Za-z0-9_-]{16,64}$'),
  transformation_ref text,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, source_type, source_id),
  CHECK ((source_type = 'derived' AND transformation_ref IS NOT NULL)
    OR (source_type <> 'derived' AND transformation_ref IS NULL)),
  CHECK (transformation_ref IS NULL OR length(transformation_ref) BETWEEN 1 AND 200),
  CHECK (recorded_at <= created_at + interval '5 minutes')
);

CREATE TABLE health.observations (
  id text NOT NULL CHECK (id ~ '^obs_[A-Za-z0-9_-]{16,64}$'),
  version integer NOT NULL CHECK (version > 0),
  user_id text NOT NULL REFERENCES identity.user_accounts(id),
  type_system text NOT NULL CHECK (type_system ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  type_code text NOT NULL CHECK (type_code ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  decimal_value numeric(21,9) NOT NULL,
  unit_system text NOT NULL CHECK (unit_system ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  unit_code text NOT NULL CHECK (unit_code ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual', 'imported', 'derived')),
  source_id text NOT NULL CHECK (source_id ~ '^[a-z]{3}_[A-Za-z0-9_-]{16,64}$'),
  provenance_id text NOT NULL,
  fact_class text NOT NULL CHECK (fact_class IN ('fact', 'declaration', 'derivation', 'clinical_assertion')),
  status text NOT NULL CHECK (status IN ('current', 'superseded', 'entered_in_error')),
  superseded_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id, version),
  FOREIGN KEY (provenance_id, user_id) REFERENCES health.provenance_records(id, user_id),
  CHECK (occurred_at <= recorded_at AND recorded_at <= ingested_at AND ingested_at <= created_at),
  CHECK ((status = 'current' AND superseded_at IS NULL)
    OR (status <> 'current' AND superseded_at IS NOT NULL)),
  CHECK (superseded_at IS NULL OR superseded_at >= created_at)
);

CREATE FUNCTION health.reject_provenance_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'provenance records are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER provenance_records_no_update
  BEFORE UPDATE ON health.provenance_records
  FOR EACH ROW EXECUTE FUNCTION health.reject_provenance_mutation();

CREATE TRIGGER provenance_records_no_delete
  BEFORE DELETE ON health.provenance_records
  FOR EACH ROW EXECUTE FUNCTION health.reject_provenance_mutation();

CREATE UNIQUE INDEX one_current_observation_version
  ON health.observations (id) WHERE status = 'current';
CREATE INDEX observations_user_time
  ON health.observations (user_id, occurred_at DESC, id, version DESC);

CREATE FUNCTION health.guard_observation_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'observations cannot be deleted directly' USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'current' AND NEW.status = 'superseded'
     AND NEW.superseded_at IS NOT NULL
     AND NEW.id = OLD.id AND NEW.version = OLD.version
     AND NEW.user_id = OLD.user_id AND NEW.type_system = OLD.type_system
     AND NEW.type_code = OLD.type_code AND NEW.decimal_value = OLD.decimal_value
     AND NEW.unit_system = OLD.unit_system AND NEW.unit_code = OLD.unit_code
     AND NEW.occurred_at = OLD.occurred_at AND NEW.recorded_at = OLD.recorded_at
     AND NEW.ingested_at = OLD.ingested_at AND NEW.source_type = OLD.source_type
     AND NEW.source_id = OLD.source_id AND NEW.provenance_id = OLD.provenance_id
     AND NEW.fact_class = OLD.fact_class AND NEW.created_at = OLD.created_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'observation history is immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER guard_observation_mutation
  BEFORE UPDATE OR DELETE ON health.observations
  FOR EACH ROW EXECUTE FUNCTION health.guard_observation_mutation();

COMMENT ON TABLE health.provenance_records IS 'Canonical source lineage; payload content is excluded.';
COMMENT ON TABLE health.observations IS 'Versioned quantitative observations; direct deletion and silent value updates are prohibited.';
