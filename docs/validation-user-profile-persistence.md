# User/profile persistence validation — 2026-09-08

Scope: B2 and the account-authorization portion of B3. This slice stores only an opaque account ID, status, locale, timezone and operational timestamps. It stores no credentials or health data.

- `pnpm check`: PASS; 15 unit/HTTP tests, OpenAPI drift and production builds.
- Real PostgreSQL integration: PASS with both immutable migrations; verifies account lookup, missing account, migration reapply, rollback and checksum drift.
- `/v1/me`: 401 without authentication; 403 when the authenticated actor has no active application account; minimal profile only for an active matching account.
- Actor IDs and submitted authentication headers remain absent from structured logs.

No account-creation endpoint exists. Provisioning belongs to the future production identity lifecycle. Consent, audit events and privacy UI remain unimplemented pending approved processing purposes and legal mapping.
