#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$repo_root/.local/backups"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_path="$backup_dir/glucora-$stamp.dump"
manifest_path="$backup_dir/glucora-$stamp.manifest.json"
restore_db="glucora_restore_${GITHUB_RUN_ID:-local}_$$"
if [[ ! "$restore_db" =~ ^glucora_restore_[A-Za-z0-9_]+$ ]]; then
  echo "Unsafe restore database name" >&2
  exit 1
fi

compose=(docker compose --env-file "$repo_root/.env.local" -f "$repo_root/infrastructure/compose.yaml")
cleanup() {
  "${compose[@]}" exec -T postgres dropdb -U glucora --if-exists "$restore_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

start_epoch="$(date +%s)"
"${compose[@]}" exec -T postgres pg_dump -U glucora -d glucora -Fc --no-owner --no-privileges > "$dump_path"
test -s "$dump_path"
checksum="$(sha256sum "$dump_path" | cut -d ' ' -f1)"
source_migrations="$("${compose[@]}" exec -T postgres psql -U glucora -d glucora -tA -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM glucora_meta.schema_migrations')"

"${compose[@]}" exec -T postgres createdb -U glucora "$restore_db"
"${compose[@]}" exec -T postgres pg_restore -U glucora -d "$restore_db" --exit-on-error --no-owner --no-privileges < "$dump_path"
restored_migrations="$("${compose[@]}" exec -T postgres psql -U glucora -d "$restore_db" -tA -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM glucora_meta.schema_migrations')"
test "$source_migrations" = "$restored_migrations"
"${compose[@]}" exec -T postgres psql -U glucora -d "$restore_db" -tA -v ON_ERROR_STOP=1 -c \
  "SELECT CASE WHEN to_regclass('health.observations') IS NOT NULL AND to_regclass('timeline.items') IS NOT NULL AND to_regclass('consultation.reports') IS NOT NULL AND to_regclass('privacy.requests') IS NOT NULL AND to_regclass('sharing.grants') IS NOT NULL THEN 'ok' ELSE 'missing' END" | grep -qx ok

duration_seconds="$(( $(date +%s) - start_epoch ))"
cat > "$manifest_path" <<JSON
{"format":"postgres-custom","created_at":"$stamp","sha256":"$checksum","schema_migrations":$restored_migrations,"restore_verified":true,"duration_seconds":$duration_seconds}
JSON
echo "$manifest_path"
