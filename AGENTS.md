# Glucora implementation instructions

Implement the approved Source of Truth, not agent product or clinical preferences.
Read docs/source-of-truth/13-9.md and the relevant initiative documents before changes.
Authority: Foundation → Product/Clinical/Compliance → AI/Data → Technology/Operations → Roadmap → accepted ADRs → Blueprint → code.
Stack: pnpm monorepo, React/TypeScript/Vite/Tailwind/shadcn, Fastify, PostgreSQL canonical; modular monolith.
Current scope: Initiative A only until docs/implementation-plan.md foundation gate is satisfied.
Strategic/material architecture, data, security, clinical or AI changes require a proposed ADR before implementation; proposals are not acceptance.
Never pick strategic cloud, identity, queue, storage, AI or observability providers silently.
Domain must not depend on React, Fastify or database clients; web must not import API infrastructure.
Preserve fact taxonomy, temporal semantics, provenance, versioned correction; absence is not a negative fact.
Deny health access by default; identity or sponsor/admin role alone never grants authority.
Do not log health payloads, full URLs, headers, tokens or raw AI prompts/responses.
AI is assistive: no autonomous diagnosis, treatment changes or insulin dosing; R3 requires human authority and R4 is out of scope.
Use synthetic tests only. Never disable or weaken safety/privacy tests to obtain green checks.
Work in small slices; run lint, format check, typecheck, tests, OpenAPI checks and build; run PostgreSQL integration and E2E for affected paths.
Update contracts, implementation plan and relevant docs in the same change. Do not claim unexecuted checks or beta readiness.
