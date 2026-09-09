# Plano de implementação

Referências: [13.8](source-of-truth/13-8.md), [13.12](source-of-truth/13-12.md), [11.9](source-of-truth/11-9.md).
Escopo inicial concluído: **Iniciativa A**. As iniciativas seguintes avançam em slices condicionados aos respectivos gates.

| Item | Implementação                                 | Evidência exigida                             |
| ---- | --------------------------------------------- | --------------------------------------------- |
| A1   | pnpm workspaces, estrutura e AGENTS.md        | instalação limpa                              |
| A2   | lint, formato, TypeScript, Vitest, Playwright | check e E2E                                   |
| A3   | shell web responsivo, estados de conexão      | build e navegador                             |
| A4   | Fastify com erros seguros e contrato /v1      | testes HTTP                                   |
| A5   | PostgreSQL local e ledger transacional        | migrations reais, repetição, rollback e drift |
| A6   | validação de env, segredo local gerado        | testes de env e fail-fast                     |
| A7   | logs mínimos, request_id do servidor          | testes contra vazamento                       |
| A8   | CI, lockfile, scans                           | execução remota                               |
| A9   | liveness independente e readiness real        | falha/recuperação PostgreSQL                  |

Estado: A1–A9 implementados e validados localmente e no CI Linux; resultados em [validation.md](validation.md). O gate de governança permanece HOLD pela indisponibilidade de proteção de main no plano atual.
Gate de saída: clone → install → env → PostgreSQL → migrate → dev → checks reproduzíveis; pendências conhecidas registradas.
A aprovação deste gate de engenharia não significa aprovação dos gates clínicos, privacidade, produto ou beta.

## Sequência seguinte

B Identity/Consent → C Longitudinal Data → D Timeline → E Consultation → F Low-risk AI → G Privacy → H Operational Readiness.
Antes de B: atualizar leitura de Product/Clinical/Compliance, contrato de identidade, propósito/consentimento, matriz de autorização e decisão de adapter local versus provider. Não escolher provider estratégico implicitamente.
F exige contexto/evidência/evals; H exige responsáveis, backup/restore e aprovação operacional antes de beta.
Iniciativa B em andamento: B1 concluído; B2 possui persistência mínima de conta/perfil; B3 possui autenticação local fail-closed e `/v1/me` autorizado somente para conta ativa. B4/B5 possuem fundação versionada e append-only, sem finalidade real cadastrada. B6 possui política deny-by-default e matriz sintética, sem capacidade ativada. B7 possui fundação de auditoria mínima e imutável, sem emissores reais. B8 possui interface responsiva com estado vazio e controles futuros claramente indisponíveis. ADR-013 a ADR-016 permanecem PROPOSED. A ativação de consentimento aguarda definição/aceite das finalidades, base legal, retenção, taxonomia de auditoria e arquitetura de identidade de produção.
As demais iniciativas permanecem backlog documentado, sem tabelas ou endpoints especulativos.

Iniciativa C iniciada: C1 possui núcleo de domínio para observações quantitativas com valor exato, unidade, tempos UTC, origem, provenance, classe factual, status e versão. Persistência, captura e catálogos clínicos continuam bloqueados até os gates aplicáveis; ADR-017 permanece PROPOSED.

C2/C4 em fundação: PostgreSQL e repository suportam gravação atômica de uma observação inicial e sua provenance, sem endpoint ou catálogo clínico. ADR-018 permanece PROPOSED; captura real continua bloqueada.

C5 em fundação: correção preserva a versão anterior, cria provenance e auditoria na mesma transação e bloqueia conflito de versão. ADR-019 permanece PROPOSED; o fluxo não está exposto ao usuário.

C6–C8 em fundação: timezone IANA e offset são preservados e validados; catálogo de tipo/unidade é deny-by-default; consultas correntes usam ownership e paginação keyset. ADR-020 permanece PROPOSED; catálogo e API reais continuam bloqueados.

C3 em fundação: eventos contextuais canônicos preservam categoria codificada, declaração controlada, provenance, timezone e versão. O catálogo é injetado e deny-by-default; categorias reais, correções e API aguardam gates. ADR-021 permanece PROPOSED.

Iniciativa D iniciada: D1/D5 possuem projeção cronológica descartável e rebuild transacional por usuário, com referências de origem/versão e sem payload clínico. D2–D4 e D6–D7 continuam pendentes; ADR-022 permanece PROPOSED.

D2–D4/D7 em fundação interna: leitura exige autorização completa antes do repository, suporta filtros limitados por período/categoria/origem, agrupamento pelo dia local e estado vazio que não interpreta ausência como evento negativo. A API pública e a UX aguardam finalidade real e critérios de aceite aprovados.

Iniciativa E iniciada: E1–E3 possuem composição determinística interna de inventário por período, categoria e origem, sempre acompanhada de limitações explícitas. O registro de risco propõe R0; persistência, perguntas, exportação, compartilhamento e exposição aguardam gates.

E3/E7 em fundação: relatório determinístico imutável preserva snapshot, referências/versões, idempotência e auditoria atômica. ADR-023 permanece PROPOSED; retenção real, exportação, compartilhamento e exposição continuam condicionados.

Iniciativa G iniciada: G1/G3/G7 possuem domínio e schema de workflow para solicitações de acesso, exportação e exclusão, com versão e histórico append-only. ADR-024 permanece PROPOSED; adapters de fulfillment, SLA, verificação e UI continuam condicionados a Compliance/Operations.
