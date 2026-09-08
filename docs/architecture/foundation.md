# Engineering foundation

Implements accepted ADR-001/002/003/004 and Blueprint 13.1/13.7/13.10.
pnpm workspaces keep a single build and a modular-monolith API. No cloud vendor is selected.

Dependencies flow web → contracts/UI, API → contracts/config/observability and PostgreSQL adapter.
Contracts contain runtime JSON schemas and no application implementation.
Domain remains framework-free and unimplemented until B; eslint enforces forbidden imports.
The sole runtime persistence adapter uses pg with bounded connection/query timeouts. SQL migrations run explicitly before startup, under a transaction and advisory lock, with immutable SHA-256 history.
Baseline stores operational metadata only. No ORM, clinical schema or distributed persistence is selected.
API production builds bundle local packages; runtime external dependencies remain declared in services/api/package.json.
Public probes are intentionally unauthenticated and return minimal status. No business route is registered.
The web shell uses a local shadcn/ui Button implementation following its Radix/CVA composition; no external fonts or telemetry.
Tooling references: [Fastify logging](https://fastify.dev/docs/latest/Reference/Logging/), [shadcn monorepo](https://ui.shadcn.com/docs/monorepo).
These reversible engineering choices implement accepted architecture; no new strategic ADR was accepted.

The esbuild override pins 0.28.2 to address GHSA-g7r4-m6w7-qqqr in the build dependency tree; full build and browser tests validate compatibility.
