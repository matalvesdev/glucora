# Plano de implementação

Referências: [13.8](source-of-truth/13-8.md), [13.12](source-of-truth/13-12.md), [11.9](source-of-truth/11-9.md).
Escopo desta primeira execução: **Iniciativa A somente**.

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

Estado inicial: implementação em validação. Resultados finais em validation.md.
Gate de saída: clone → install → env → PostgreSQL → migrate → dev → checks reproduzíveis; pendências conhecidas registradas.
A aprovação deste gate de engenharia não significa aprovação dos gates clínicos, privacidade, produto ou beta.

## Sequência seguinte

B Identity/Consent → C Longitudinal Data → D Timeline → E Consultation → F Low-risk AI → G Privacy → H Operational Readiness.
Antes de B: atualizar leitura de Product/Clinical/Compliance, contrato de identidade, propósito/consentimento, matriz de autorização e decisão de adapter local versus provider. Não escolher provider estratégico implicitamente.
F exige contexto/evidência/evals; H exige responsáveis, backup/restore e aprovação operacional antes de beta.
As iniciativas futuras permanecem backlog documentado, sem tabelas ou endpoints especulativos.
