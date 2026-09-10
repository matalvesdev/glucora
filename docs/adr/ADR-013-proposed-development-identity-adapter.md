# ADR-013 — Development identity adapter

Status: ACCEPTED

## Context

The production identity provider remains open. Initiative B needs an identity boundary and authorization semantics that can be tested without turning a local shortcut into a production backdoor.

## Proposal

Define a framework-independent authenticated actor contract. Provide a local adapter only when `NODE_ENV` is `development` or `test` and `AUTH_ADAPTER=development`. Production rejects that configuration during startup. The adapter accepts a synthetic opaque actor ID through a development-only header and never grants organization, sponsor, professional, support or privileged authority.

No provider, token format, login UI, credential persistence or production session architecture is selected. A future accepted identity ADR replaces the adapter behind the same boundary.

## Risks and controls

- Accidental production enablement: configuration validation rejects it.
- Header spoofing: the adapter is unavailable outside local/test environments; deployment tests cover the invariant.
- Authorization confusion: actor identity carries no resource authority; server-side policies remain deny by default.
- False completion: this slice does not satisfy account creation, recovery, consent or production authentication.

## Acceptance

Technology/Security/Product owners must accept or supersede this proposal before treating it as a durable architectural decision. Implementation may use it only as the reversible local adapter explicitly allowed by Blueprint 13.10.
