-- ADR-045: explicit review and expiry for opaque legal-hold evidence.
ALTER TABLE privacy.retention_hold_events
  ADD COLUMN review_at timestamptz,
  ADD COLUMN expires_at timestamptz;

ALTER TABLE privacy.retention_hold_events
  ADD CONSTRAINT retention_hold_events_lifecycle_check
  CHECK (
    review_at IS NOT NULL
    AND expires_at IS NOT NULL
    AND occurred_at < review_at
    AND review_at < expires_at
  );

COMMENT ON COLUMN privacy.retention_hold_events.review_at IS 'ADR-045 required UTC review instant; no health payload.';
COMMENT ON COLUMN privacy.retention_hold_events.expires_at IS 'ADR-045 required UTC expiry instant; no health payload.';
