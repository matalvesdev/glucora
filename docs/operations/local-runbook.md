# Local operations

## Start and stop

pnpm env:init → pnpm db:up → pnpm db:migrate → pnpm dev.
Ctrl+C closes web/API. API SIGINT/SIGTERM closes the database pool; a ten-second shutdown deadline prevents hanging.
pnpm db:down stops Compose and preserves its named volume. Never use down -v on a database you need to retain.

## Probes and investigation

GET /v1/health proves the process responds; GET /v1/ready checks PostgreSQL and baseline schema.
503: verify DB process, DATABASE_URL and migration completion. 500/startup failure: verify configuration and port availability.
Correlate x-request-id with request_id in structured logs. Do not enable raw request/error logging to debug.
Migration failure rolls back the batch. Resolve the cause before retrying; never edit already-applied migrations or force a checksum.

## Rollback

Foundation baseline creates only operational metadata and is deliberately forward-only.
Application rollback uses the preceding build; keep the ledger. Schema correction requires a new migration.
Disposable integration tests create their own database and drop only that exact database.
Before health data is admitted, H must deliver backup scheduling, isolated restore drill, RPO/RTO, incident owners and release approval. No production backup/restore claim is made by this foundation.

## Backup and restore drill

With the Compose database healthy and migrated, run `pnpm db:restore-drill`. The script creates a PostgreSQL custom-format dump under ignored `.local/backups`, calculates SHA-256, restores into a uniquely named isolated database, verifies the migration ledger and critical schemas, then drops only that validated restore database. It emits a non-sensitive JSON manifest with checksum, migration count, duration and restore result.

The script never drops or replaces `glucora`. A failed restore exits nonzero and CI retains failure evidence. Do not upload dump files: even encrypted infrastructure transport does not make application health data suitable for CI artifacts. Production schedule, encrypted storage, retention, RPO/RTO and accountable owner remain required before beta because the cloud/storage/KMS choices are open.

## Native Windows validation environment

When Docker is unavailable, PostgreSQL 17 binaries can run an isolated cluster in .local/pgdata on 127.0.0.1:55432.
This instance is local development only. Its credentials are in ignored .env.local; never copy them to documentation.
Stop with pg_ctl -D .local/pgdata stop. Start with pg_ctl -D .local/pgdata -l .local/postgres.log -o "-h 127.0.0.1 -p 55432" start, using the PostgreSQL bin directory.
Do not start Compose while that instance uses port 55432.

## Repository release control

The private repository was created and work is in PR #1. GitHub refused main protection with HTTP 403 under the current plan. Keep PR review and successful CI as an explicit operating rule; automated enforcement requires an eligible GitHub plan. No upgrade or change of repository visibility was performed.
