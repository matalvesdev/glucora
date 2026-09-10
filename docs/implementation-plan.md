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

G1/G3/G7 em backend: repository cria solicitações com idempotência e avança estados com controle de versão; estado, evento e auditoria são atômicos. PostgreSQL também impede transições inválidas e exclusão direta. Fulfillment e exposição continuam bloqueados.

E6/G5 em fundação: grants limitam acesso a um relatório, destinatário opaco, finalidade e validade; autorização é deny-by-default e revogação versionada. ADR-025 permanece PROPOSED; delivery e identidade do destinatário continuam abertos.

Iniciativa F iniciada: F1/F2/F6/F9 possuem registry e gateway provider-neutral com pipeline fail-closed de risco → auth/consent → evidência → provider → schema → guard → fallback. ADR-026 permanece PROPOSED; nenhuma capability real está ativa.

Iniciativa H avançada: H2/H3 possuem backup custom-format, checksum e restore drill isolado no CI, com manifesto sem dados. ADR-027 permanece PROPOSED; schedule, storage/KMS, retenção, RPO/RTO e owner de produção continuam abertos.

H1/H4/H7 em fundação: métricas HTTP/readiness possuem campos fechados sem payload sensível; runbook registra stop conditions, contenção, recuperação e evidência; threat model cobre os módulos adicionados. Exporter, alertas, paging, owners e SLAs continuam abertos.

F8/G6 em fundação: contestação append-only por output/versão usa motivos controlados, ownership e auditoria atômica; recursos contestados podem ser excluídos de contexto futuro. ADR-028 permanece PROPOSED; resolução/SLA e `ai_runs` reais continuam pendentes.

H8/H9 em gate técnico: readiness de private beta exige evidências/owners de Product, Clinical, Compliance, Security e Operations mais enrollment explícito. CI confirma estado HOLD e impede habilitação acidental. ADR-029 permanece PROPOSED; nenhum gate humano foi aceito.

F3/F7 em fundação: retrieval provider-neutral exige corpus versionado e metadados de aprovação, tratando conteúdo recuperado somente como evidência. O harness de evals versionado exige casos normal, edge, adversarial, abstention, privacy e clinical boundary e emite relatório sem payload bruto. ADR-030 permanece PROPOSED; corpus, adapter, thresholds e capabilities reais continuam pendentes.

H5 em fundação: solicitações de suporte do consumidor usam categoria controlada, idempotência, ownership e auditoria atômica, sem texto livre ou payload clínico. ADR-031 permanece PROPOSED; endpoint/UI, identidade de operador, triagem, SLA, paging e fornecedor continuam pendentes.

G8 em fundação: orquestrador provider-neutral executa plano explícito de targets canonical, projection, vendor e backup, exige recibos com evidência e converte erros externos em códigos seguros. ADR-032 permanece PROPOSED; adapters, política de retenção, subprocessadores e transição final continuam pendentes.

E5/G1 em fundação: gerador JSON estruturado aceita apenas pedido de exportação em revisão, agrega seções explícitas, preserva versões/provenance, bloqueia dados de outro titular e gera checksum determinístico. ADR-033 permanece PROPOSED; storage, criptografia, expiração, entrega, reautenticação e adapters reais continuam pendentes.

G1/G3/G7 em API condicionada: POST/GET de solicitações de privacidade exigem autenticação, conta ativa, ownership, idempotência e validação runtime; o servidor deriva titular e estado. Sem referência explícita da política de retenção, novas criações são bloqueadas, mas status existente permanece legível. ADR-034 permanece PROPOSED; identidade/política de produção, UI, verificação e fulfillment continuam pendentes.

H5 em API/UI condicionada: POST/listagem de suporte exigem autenticação, conta ativa, idempotência, categoria controlada, ownership e cursor opaco; texto livre e campos adicionais são rejeitados. A interface lista os próprios pedidos, pagina e a atualiza após criação válida. Sem referência explícita de retenção, novas entradas são bloqueadas, mas registros existentes permanecem legíveis. ADR-035 e ADR-040 permanecem PROPOSED; roteamento, operador, triagem, SLA e fornecedor continuam pendentes.

G1/G3/G7/H5 em UI condicionada: a área de privacidade e suporte consulta sessão real antes de renderizar formulários; envia somente tipo/categoria e idempotência e valida respostas pelos contratos compartilhados. ADR-036 permanece PROPOSED; login de produção, histórico completo, consentimentos e operação de suporte continuam pendentes.

G4 em API: histórico autenticado lista decisões append-only com chave, título, texto e versão imutável da finalidade, usando ownership, limite fechado e cursor opaco. ADR-037 permanece PROPOSED; finalidades, decisões reais, grant/revoke e reconsentimento continuam pendentes.

G4 em UI: após sessão válida, a área de privacidade mostra finalidade, texto, versão, decisão e data do histórico, valida o contrato e pagina pelo cursor opaco. ADR-038 permanece PROPOSED; publicação, grant/revoke e reconsentimento reais continuam pendentes.

G7 em API/UI: listagem própria de solicitações de privacidade usa ownership, limite fechado e cursor opaco; a interface mostra tipo e estado sem eventos internos e a atualiza após criação válida. ADR-039 permanece PROPOSED; verificação, transições e fulfillment continuam pendentes.

G7 em API: histórico próprio de solicitação expõe somente transições e tempos append-only, após ownership, sem códigos internos, identidades ou detalhes de fulfillment. ADR-041 permanece PROPOSED; verificação, transições e fulfillment continuam pendentes.
