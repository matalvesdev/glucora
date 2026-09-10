# Incident response runbook

Status: operational foundation; named production owners and paging provider remain required before beta.

## Trigger and containment

Open an incident for suspected cross-user disclosure, consent bypass, corrupted canonical history, unsafe clinical output, inability to restore, critical vulnerability, or sustained availability failure. Stop the affected capability first: remove traffic/disable its approved feature flag or roll back the build. Preserve audit IDs, deployment version, request IDs and timestamps. Never copy health payloads, tokens, headers, URLs, prompts or responses into the incident channel.

Suspected disclosure, consent failure, unsafe output, corrupted history and failed restore are release stop conditions. Escalate Security/Privacy and Clinical/Compliance according to impact; do not resume because the service appears healthy again.

## Triage and evidence

Classify severity and affected capability; identify time window, environments, versions and potentially affected subjects using minimal identifiers. Check readiness failures, bounded HTTP signals, audit events, migration ledger, restore manifest and deployment evidence. Record potential harm, detectability and reversibility. Keep hypotheses distinct from confirmed facts.

## Recovery and closure

Restore service through rollback or reviewed forward fix. For data integrity, prove canonical history and rebuild projections. For restore incidents, rerun the isolated drill before reopening. Validate authorization/consent and synthetic critical paths. Closure requires root cause, impact, corrective/preventive actions, owner, due date, residual-risk decision and assessment of notification/regulatory duties by authorized roles.

No production paging route, severity SLA or accountable roster is invented here. These are mandatory H4/H5 inputs before controlled beta.
