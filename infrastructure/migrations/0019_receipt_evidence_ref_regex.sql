-- PostgreSQL regular expressions accept repetition bounds only up to 255.
ALTER TABLE privacy.deletion_target_receipts
  DROP CONSTRAINT deletion_target_receipts_evidence_ref_check;
ALTER TABLE privacy.deletion_target_receipts
  ADD CONSTRAINT deletion_target_receipts_evidence_ref_check
  CHECK (evidence_ref IS NULL OR evidence_ref ~ '^[A-Za-z0-9:_-]{8,255}$');
