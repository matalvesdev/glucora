# Foundation validation — 2026-09-08

Scope: Initiative A (A1–A9), synthetic data only.

| Check                           | Local result                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Node / pnpm                     | Node 24.20.0, pnpm 10.32.1                                                           |
| lint / formatting / TypeScript  | PASS                                                                                 |
| Unit and HTTP privacy/contracts | 12 PASS                                                                              |
| Real PostgreSQL integration     | 1 PASS: migration reapply, schema readiness, rollback and checksum drift             |
| Browser E2E                     | 2 PASS: responsive shell → compiled API → PostgreSQL; failure/retry                  |
| OpenAPI contract drift          | PASS, structural comparison                                                          |
| Web and API production builds   | PASS; compiled API used by E2E                                                       |
| Dependency audit                | No known vulnerabilities reported                                                    |
| Local Docker Compose            | PASS in Linux CI; Docker unavailable on the local Windows host                       |
| GitHub main protection          | HOLD: GitHub returned HTTP 403, private-repository feature requires an eligible plan |

Remote evidence: [Foundation CI — successful push run](https://github.com/matalvesdev/glucora/actions/runs/34279738669), including frozen installation, all checks, Gitleaks, Compose, real PostgreSQL integration and browser E2E. The PR workflow also needs read-only pull-request metadata access for Gitleaks; that permission is now configured with scanner comments disabled. Branch protection is not active; keep review and green checks before merge.
Snapshots: 30 selected Source of Truth documents, including Constitution, all 12 accepted ADRs, Blueprint and roadmap gates. This is not an automatic Drive mirror.
No strategic vendor selected, no clinical capability, no beta/release approval. Metrics/traces exporters, production secrets/roles/TLS, backup/restore, incident ownership and Identity/Consent remain future initiative work.

## GCP infrastructure contract — 2026-09-17

ADR-050 selects Google Cloud `southamerica-east1` and is represented by a Terraform module in `infrastructure/gcp`. Its `enable_resources` switch defaults to `false`; this repository has not run Terraform, authenticated to Google Cloud, or created external resources. The CI static contract verifies the regional lock, private Cloud Run ingress, Scheduler OIDC, protected Cloud SQL, non-public buckets, and the 90-day backup lifecycle. Terraform CLI validation remains a deployment-gate check because Terraform is not installed on this Windows host.
