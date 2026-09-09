-- C6: preserve the user's timezone context and observed UTC offset.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM health.observations) THEN
    RAISE EXCEPTION 'observation timezone migration requires an explicit backfill';
  END IF;
END;
$$;

ALTER TABLE health.observations
  ADD COLUMN observed_timezone text NOT NULL
    CHECK (observed_timezone ~ '^[A-Za-z_+-]+(?:/[A-Za-z0-9_+-]+)+$'),
  ADD COLUMN utc_offset_minutes smallint NOT NULL
    CHECK (utc_offset_minutes BETWEEN -840 AND 840);

COMMENT ON COLUMN health.observations.observed_timezone IS 'IANA timezone supplied for the observation context; UTC remains canonical storage.';
COMMENT ON COLUMN health.observations.utc_offset_minutes IS 'Offset applicable at occurred_at, preserving DST-era context.';

CREATE FUNCTION health.guard_observation_timezone_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.observed_timezone IS DISTINCT FROM OLD.observed_timezone
     OR NEW.utc_offset_minutes IS DISTINCT FROM OLD.utc_offset_minutes THEN
    RAISE EXCEPTION 'observation timezone context is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_observation_timezone_mutation
  BEFORE UPDATE ON health.observations
  FOR EACH ROW EXECUTE FUNCTION health.guard_observation_timezone_mutation();
