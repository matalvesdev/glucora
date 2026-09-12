-- PostgreSQL regular expressions accept repetition bounds only up to 255.
ALTER TABLE privacy.retention_hold_events
  DROP CONSTRAINT retention_hold_events_evidence_ref_check;
ALTER TABLE privacy.retention_hold_events
  ADD CONSTRAINT retention_hold_events_evidence_ref_check
  CHECK (evidence_ref ~ '^[A-Za-z0-9:_-]{8,255}$');
