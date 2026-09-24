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

## Identity persistence extension

The application now resolves an authenticated opaque actor against `identity.user_accounts`. Authentication alone is insufficient: missing or disabled records receive a generic denial. The table stores no credentials, email or health information. Parameterized lookup prevents identifier injection, and responses/logs do not disclose whether another account exists. Production identity, account provisioning, session revocation and privileged roles remain open.

## Longitudinal, sharing, privacy and AI extensions

- Canonical health records are user-scoped, versioned and provenance-linked; direct destructive mutation is blocked. Primary threats remain purpose misconfiguration, compromised consumer sessions and privileged database access.
- Timeline is disposable and contains references/metadata rather than measurement values or free text. Rebuild uses a per-user lock. Projection staleness must remain visible before user exposure.
- Structured export is restricted to the owning active account and requires an
  identity-provider authentication time no older than ten minutes. It uses
  parameterized subject queries, returns `no-store`, creates no public URL and
  fails closed when identity time or export adapters are unavailable.
- Report sharing is bound to one owner-owned artifact, opaque recipient, purpose and expiry. Revocation is checked for every future access. Recipient authentication and delivery links remain unimplemented because token leakage, forwarding and enumeration need a dedicated design/review.
- Privacy requests use scoped lookup, optimistic versions, controlled reason codes and atomic audit. Fulfillment cannot be marked complete until every applicable store/vendor reports evidence.
- AI execution denies R2+, validates authorization before context/provider access, requires versioned evidence and structured guards, and abstains safely. Prompt injection, provider data use and corpus poisoning remain blocked from release until real adapters/corpora have threat review and eval evidence.
- Operational metrics accept only method, route template, status, duration and readiness failure. Interfaces do not accept arbitrary labels, reducing accidental health data cardinality/leakage.
