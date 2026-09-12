-- ADR-046: a retained target must identify its opaque legal-hold ledger.
ALTER TABLE privacy.deletion_target_receipts
  ADD COLUMN legal_hold_ref text;

ALTER TABLE privacy.deletion_target_receipts
  ADD CONSTRAINT deletion_target_receipts_hold_binding_check
  CHECK (
    (outcome = 'retained' AND reason_code = 'legal_hold_documented' AND legal_hold_ref ~ '^[A-Za-z0-9:_-]{8,128}$')
    OR (outcome <> 'retained' AND legal_hold_ref IS NULL)
  );

COMMENT ON COLUMN privacy.deletion_target_receipts.legal_hold_ref IS 'ADR-046 opaque reference to holder-scoped legal hold; no payload.';
