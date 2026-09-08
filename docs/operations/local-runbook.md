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

## Native Windows validation environment

When Docker is unavailable, PostgreSQL 17 binaries can run an isolated cluster in .local/pgdata on 127.0.0.1:55432.
This instance is local development only. Its credentials are in ignored .env.local; never copy them to documentation.
Stop with pg_ctl -D .local/pgdata stop. Start with pg_ctl -D .local/pgdata -l .local/postgres.log -o "-h 127.0.0.1 -p 55432" start, using the PostgreSQL bin directory.
Do not start Compose while that instance uses port 55432.
