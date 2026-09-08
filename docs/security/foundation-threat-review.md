# Foundation security and privacy review

Scope: public availability probes and a static shell; no health data storage, identity, AI or third-party runtime calls.

- Incoming URL/header/body/request-id are untrusted. Generate request IDs server-side; log only route templates or "unmatched", method, status and duration.
- Never serialize errors: pg/validation exceptions can embed credentials or submitted data. Tests exercise these boundaries with synthetic canaries.
- 32 KiB request body limit, 10-second request timeout, bounded DB pool/query timeouts, security headers and cache-control no-store.
- Configuration errors report field names only. Secrets are local, generated and ignored. Startup failures have fixed messages.
- Operational ledger uses parameters, schema privilege revocation, advisory lock and transaction; migration runner account is separate in concept from the production runtime role.
- Local development database account is privileged for disposable testing. Production least-privilege roles/TLS/secret store require the deployment ADR and must be delivered before sensitive data.
- Authentication and authorization are not simulated. No patient-facing capability exists; deny-by-default is absence of business routes.
- No analytics, remote fonts, ad pixels, AI calls or service-worker health caching.
  Residual risks: internet-facing abuse/rate limiting and edge TLS deployment, auth/CSRF, production roles, metrics/tracing exporter, external security review and clinical/privacy gates are future requirements, not completed controls.
