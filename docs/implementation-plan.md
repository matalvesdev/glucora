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

H6: a varredura de segredos no CI executa o binário oficial Gitleaks com versão e checksum fixos sobre o histórico Git, sem depender da licença da GitHub Action. A validação de checksum falha antes da execução caso o artefato não corresponda ao release aprovado.

## Sequência seguinte

Registro de decisão: ADR-013 a ADR-041 foram aceitos por Mateus Alves Bassane em 2026-09-10, com evidência `00001`. As referências históricas a `PROPOSED` nas entradas abaixo descrevem o estado no momento daquele slice e são substituídas por este registro; limites que os ADRs mantêm abertos continuam abertos até uma decisão específica posterior.

ADR-042 foi aceito por Mateus Alves Bassane em 2026-09-11, com evidência `00001`; a ativação de cada fluxo continua condicionada à implementação e validação dos controles definidos nessa decisão.

ADR-043 foi aceita para classificar a exclusão canônica de dados de saúde e a evidência mínima conservada. A captura de saúde permanece bloqueada até sua implementação validada.

O inventário inicial de tratamento em `docs/compliance/data-processing-inventory.md` registra as categorias aprovadas na ADR-042, seus responsáveis, operadores ainda não aprovados e evidências de eliminação pendentes.

B Identity/Consent → C Longitudinal Data → D Timeline → E Consultation → F Low-risk AI → G Privacy → H Operational Readiness.
Antes de B: atualizar leitura de Product/Clinical/Compliance, contrato de identidade, propósito/consentimento, matriz de autorização e decisão de adapter local versus provider. Não escolher provider estratégico implicitamente.
F exige contexto/evidência/evals; H exige responsáveis, backup/restore e aprovação operacional antes de beta.

ADR-050 foi aceita: a fundação de produção será Google Cloud `southamerica-east1`, com Cloud Run, Cloud SQL PostgreSQL, Cloud Storage, Cloud Scheduler, Identity Platform e Secret Manager. A infraestrutura versionada declara recursos privados com criação bloqueada por padrão e contrato estático no CI; não cria recursos externos, valores de segredos, configuração de identidade ou executor de exclusão. IAM mínimo, gestão de API/Identity Platform, restore, exclusão de backup e release continuam gates operacionais antes de qualquer apply.

ADR-051 foi aceita: tokens OIDC do Identity Platform serão verificados por assinatura e claims antes de resolver um vínculo único entre sujeito externo e conta interna. O vínculo e o adapter não habilitam provisioning, login, cookies ou autorização de saúde por papel; ausência ou falha permanece deny-by-default.

B3 em fundação de produção: adapter OIDC recebe somente Bearer token, exige assinatura RS256 e claims de Identity Platform antes de resolver sujeito externo; sem vínculo interno, token inválido ou erro de chave, nega a autenticação. O runtime o conecta somente por configuração explícita e permanece fail-closed sem project ID válido.

B3 em fundação de produção: `identity.subject_bindings` preserva somente o vínculo único e imutável entre `identity_platform`+`sub` e conta interna. Não há endpoint de criação, alteração ou exclusão; a consulta do adapter é parametrizada e retorna ausência quando o vínculo não existe.

B3 em runtime condicionado: `AUTH_ADAPTER=identity_platform` exige project ID válido no startup e conecta token verificado ao repositório de vínculos. Configuração ausente/inválida falha cedo; o deploy continua bloqueado até a configuração real do Identity Platform e seus gates de release.
Iniciativa B em andamento: B1 concluído; B2 possui persistência mínima de conta/perfil; B3 possui autenticação local fail-closed e `/v1/me` autorizado somente para conta ativa. B4/B5 publicam a versão 1 da finalidade `self_care_health_data` aprovada na ADR-042 e expõem consulta, concessão e revogação autenticadas, idempotentes e auditadas na mesma transação. B6 mantém política deny-by-default e matriz sintética: nenhuma capacidade de captura ou leitura de saúde é liberada por este slice. B7 mantém auditoria mínima e imutável, agora com emissor de decisão de consentimento. B8 mostra a finalidade, a base legal, a retenção e o controle de autorização/revogação. A identidade de produção continua aberta; o adapter de desenvolvimento segue proibido em produção.
As demais iniciativas permanecem backlog documentado, sem tabelas ou endpoints especulativos.

Iniciativa C avançada: C1 possui núcleo de domínio e C2/C4/C5 entregam captura e correção próprias da medição manual aprovada, com persistência, provenance, versões e auditoria. Categorias clínicas adicionais, conversão, interpretação e alertas continuam bloqueados; ADR-017 está aceita.

ADR-052 foi aceita com LOINC `2339-0`, `mg/dL`, inserção manual capilar declarada pelo titular e ausência de faixas/alertas. C2 expõe criação autenticada/idempotente, leitura própria paginada desse único catálogo e interface que coleta somente valor e momento, todas condicionadas a conta ativa, ownership e consentimento vigente para `self_care_health_data`; não há conversão, interpretação, faixa, alerta ou beta neste slice.

C2/C4 implementados no escopo aprovado: PostgreSQL e repository suportam gravação atômica da observação manual aprovada e sua provenance, condicionadas a ownership e consentimento. Nenhum catálogo clínico adicional é habilitado. ADR-018 está aceita.

C2/C4 em fundação: a provenance agora é validada no domínio e no adapter antes da transação, incluindo identidade, fonte, timestamps e evidência de transformação para dados derivados. A validação não habilita captura pública ou catálogo clínico.

C5 implementado no escopo aprovado: correção preserva a versão anterior, cria provenance e auditoria na mesma transação e bloqueia conflito de versão. ADR-019 está aceita.

ADR-054 expõe C5 exclusivamente para a medição manual aprovada na ADR-052:
a rota e a interface exigem ownership, consentimento, idempotência e versão
esperada; a versão anterior é preservada como superseded.

C6–C8 em fundação: timezone IANA e offset são preservados e validados; catálogo de tipo/unidade é deny-by-default; consultas correntes usam ownership e paginação keyset. ADR-020 está aceita; catálogo e API reais continuam bloqueados.

C3 em fundação: eventos contextuais canônicos preservam categoria codificada, declaração controlada, provenance, timezone e versão. O catálogo é injetado e deny-by-default; categorias reais, correções e API aguardam gates. ADR-021 está aceita.

Iniciativa D: D1–D7 possuem projeção cronológica descartável, rebuild transacional, leitura própria autorizada, filtros fechados, cursor opaco, agrupamento local, estado vazio sem inferência e interface responsiva. A ADR-053 condiciona o acesso à finalidade publicada e ao consentimento vigente; a timeline não é source of truth nem inclui interpretação clínica.

D2–D4/D7 implementados no escopo aprovado: leitura exige autorização completa antes do repository, suporta filtros limitados por período/categoria/origem, agrupamento pelo dia local e estado vazio que não interpreta ausência como evento negativo. A API pública e a UX seguem a ADR-053.

D2–D4/D7 implementados: parâmetros de consulta, período e cursor opaco são validados antes da consulta PostgreSQL; filtros malformados são rejeitados sem atingir a projeção.

Iniciativa E avançada: E1–E4 possuem composição determinística interna de inventário por período, categoria e origem, relatório próprio e checklist fechado de perguntas não clínicas, sempre acompanhados de limitações explícitas. O registro de risco propõe R0; exportação, compartilhamento e exposição continuam aguardando gates.

ADR-055 aceita a criação e consulta própria de relatório determinístico de
preparação de consulta, com período explícito, consentimento vigente,
idempotência, referências/versionamento e auditoria. Perguntas, notas,
exportação, compartilhamento, IA e acesso profissional seguem fora deste
slice.

ADR-056 aceita um checklist fechado de perguntas não clínicas ligado ao
relatório próprio. Notas livres, geração por IA, aconselhamento,
compartilhamento e exportação continuam fora de escopo.

E3/E7 em fundação: relatório determinístico imutável preserva snapshot, referências/versões, idempotência e auditoria atômica. ADR-023 está aceita; retenção real, exportação, compartilhamento e exposição continuam condicionados.

E3/E7 em fundação: o snapshot de relatório é validado antes da persistência; período, contagens, limitações, referências/versionamento e tempo de criação precisam ser coerentes. O controle não habilita exportação, compartilhamento ou exposição pública.

Iniciativa G iniciada: G1/G3/G7 possuem domínio e schema de workflow para solicitações de acesso, exportação e exclusão, com versão e histórico append-only. ADR-024 está aceita; adapters de fulfillment, SLA, verificação e UI continuam condicionados a Compliance/Operations.

G1/G3/G7 em backend: repository cria solicitações com idempotência e avança estados com controle de versão; estado, evento e auditoria são atômicos. PostgreSQL também impede transições inválidas e exclusão direta. Fulfillment e exposição continuam bloqueados.

E6/G5 em fundação: grants limitam acesso a um relatório, destinatário opaco, finalidade e validade; autorização é deny-by-default e revogação versionada. ADR-025 está aceita; delivery e identidade do destinatário continuam abertos.

ADR-057 aceita e o código entrega a gestão autenticada pelo titular de criação,
listagem paginada, consulta e revogação versionada de grants próprios, com
controles e histórico na tela de preparação de consulta. O slice não habilita
delivery, identidade do destinatário, download ou acesso de terceiros.

ADR-058 aceita uma infraestrutura gratuita somente para sandbox com dados
sintéticos. GitHub Actions, Cloudflare Pages e Supabase Free são opções de
desenvolvimento/piloto técnico; a fundação GCP da ADR-050 permanece a opção de
produção e exige seus próprios gates operacionais.

ADR-060 fecha a hospedagem da API do sandbox com Render Free e Blueprint de
deploy manual. Migrações precedem o start, readiness depende do PostgreSQL e os
segredos são solicitados fora do repositório. O ambiente continua restrito a
dados sintéticos e não satisfaz gates de produção ou beta clínico.

ADR-059 aceita Capacitor como casca Android do MVP. O repositório ainda não
versiona SDK, Gradle gerado ou keystore. O CI constrói o projeto Android de
forma efêmera, publica checksum e instala no emulador o mesmo APK candidato à
promoção: debug sem secrets, release assinado quando os secrets estiverem
presentes. A evidência remota do smoke e a assinatura continuam gates de
release.

H9 Android: o workflow `36023096257` validou o APK debug em emulador API 35,
com instalação, abertura da activity principal e processo vivo. O release
assinado e seu smoke permanecem bloqueados pelos secrets de assinatura.

Iniciativa F iniciada: F1/F2/F6/F9 possuem registry e gateway provider-neutral com pipeline fail-closed de risco → auth/consent → evidência → provider → schema → guard → fallback. ADR-026 está aceita; nenhuma capability real está ativa.

F1 em fundação: o registry valida ID, intended use, risco, bundle, responsável, corpus, evidência mínima e tools allowlisted antes de ativar uma capability. Não há capability real nem provider selecionado.

Iniciativa H avançada: H2/H3 possuem backup custom-format, checksum e restore drill isolado no CI, com manifesto sem dados. ADR-027 está aceita; schedule, storage/KMS, retenção, RPO/RTO e owner de produção continuam abertos.

H1/H4/H7 em fundação: métricas HTTP/readiness possuem campos fechados sem payload sensível; runbook registra stop conditions, contenção, recuperação e evidência; threat model cobre os módulos adicionados. Exporter, alertas, paging, owners e SLAs continuam abertos.

H1/H4 em fundação: o logger remove recursivamente campos de conteúdo, saúde e credenciais de objetos estruturados antes de emissão, além da redaction do runtime. Exporter e observabilidade de produção permanecem abertos.

F8/G6 em fundação: contestação append-only por output/versão usa motivos controlados, ownership e auditoria atômica; recursos contestados podem ser excluídos de contexto futuro. ADR-028 está aceita; resolução/SLA e `ai_runs` reais continuam pendentes.

H8/H9: readiness de private beta exige evidências/owners de Product, Clinical, Compliance, Security e Operations mais enrollment explícito. Os cinco gates foram aprovados por Mateus Alves Bassane com a evidência `00001`; enrollment foi habilitado por autorização explícita. CI executa a validação estrita. ADR-029 está aceita; a decisão de arquitetura nela descrita não substitui as aprovações registradas no gate.

F3/F7 em fundação: retrieval provider-neutral exige corpus versionado e metadados de aprovação, tratando conteúdo recuperado somente como evidência. O harness de evals versionado exige casos normal, edge, adversarial, abstention, privacy e clinical boundary e emite relatório sem payload bruto. ADR-030 está aceita; corpus, adapter, thresholds e capabilities reais continuam pendentes.

H5 em fundação: solicitações de suporte do consumidor usam categoria controlada, idempotência, ownership e auditoria atômica, sem texto livre ou payload clínico. ADR-031 está aceita; endpoint/UI, identidade de operador, triagem, SLA, paging e fornecedor continuam pendentes.

G8 em implementação parcial: o orquestrador provider-neutral executa plano explícito de targets canonical, projection, vendor e backup, exige recibos com evidência e converte erros externos em códigos seguros. Com a ADR-043 aceita, o adapter PostgreSQL canônico remove em transação os registros de saúde e eventos de consentimento do titular somente para pedido de exclusão em revisão; o pedido e sua auditoria são conservados. Backup, fornecedor, subprocessadores, política operacional de retenção e transição final continuam pendentes.

ADR-044 foi aceita para o próximo gate de G8: ciclo operacional de retenção/exclusão, bloqueio jurídico documentado, recibos mínimos e condição de conclusão. Até sua implementação validada, nenhum pedido é concluído automaticamente e a captura pública de saúde continua bloqueada.

G8/ADR-044 em fundação: o domínio calcula de modo determinístico os prazos da ADR-042 a partir de revogação ou pedido válido: 30 dias para sistemas ativos e 90 para backups. O cálculo não agenda execução nem aprova providers.

G8/ADR-044 em fundação: PostgreSQL conserva eventos append-only de aplicação/liberação de bloqueio jurídico e recibos opacos por target de exclusão. Os registros não aceitam payload de saúde, texto livre ou contagens. A qualificação de bloqueio, autorização de operador, montagem de plano e execução agendada permanecem condicionadas aos slices seguintes.

ADR-045 foi aceita para completar a evidência temporal mínima do bloqueio jurídico: cada evento agora preserva revisão e expiração em UTC, e a consulta por titular/referência permite avaliação fail-closed da vigência. O vínculo entre recibo e bloqueio foi implementado; executor autorizado e ciclo agendado continuam pendentes.

ADR-046 foi aceita para vincular recibo retido ao ledger do mesmo titular. O orquestrador interno só aceita um target retido quando há hold documentado, ativo e não vencido; falhas mantêm a solicitação incompleta. A transição de workflow e a execução operacional seguem bloqueadas.

G8 em fundação: recibos persistidos podem ser relidos somente pelo pedido e titular correspondentes, em ordem determinística, para que uma futura transição interna valide a evidência já conservada. Esta leitura não altera estado nem habilita executor, transição automática ou operação pública.

G8 em fundação: a reconciliação interna exige cobertura persistida de cada target do plano e revalida retenções contra o hold vigente do titular. Ausência, falha ou evidência de outro titular mantém o resultado incompleto; a transição interna versionada ocorre somente após essa reconciliação.

ADR-047 foi aceita: uma transição preparada após reconciliação completa é atribuída ao sistema, nunca ao consumidor. A persistência PostgreSQL preserva o ator `system` sem identificador de consumidor.

ADR-048 foi aceita: a finalização interna relê e reconcilia evidências persistidas antes da transição versionada. Ausência de target ou conflito mantém o pedido sem mudança; exposição pública e agendamento permanecem pendentes.

ADR-049 foi aceita: a finalização interna exige plano com cobertura mínima das classes canonical, projection, vendor e backup, além de recibo persistido para cada target. O requisito não escolhe adapters, fornecedores, agenda ou exposição pública.

G8 em fundação: o percurso completo de finalização interna é exercitado contra PostgreSQL com recibos sintéticos persistidos das quatro classes e auditoria `system`. A prova não habilita executor, agenda, endpoint público ou credenciais operacionais.

G8 em fundação: a reconciliação revalida o recibo persistido mais recente de cada target antes de tratá-lo como cobertura; evidência ausente, data inválida ou semântica de retenção inválida mantêm o pedido incompleto.

E5/G1 em fundação validada: gerador JSON estruturado aceita apenas pedido de exportação em revisão, agrega seções explícitas, preserva versões/provenance, bloqueia dados de outro titular e gera checksum determinístico, com testes sintéticos. ADR-033 está aceita; storage, criptografia, expiração, entrega, reautenticação e adapters reais continuam pendentes.

ADR-061 entrega E5/G1 por geração direta ao próprio titular: a API exige
autenticação com `auth_time` de até dez minutos, conta ativa e ownership,
avança o pedido de forma auditada para `in_review` e agrega adapters PostgreSQL
de conta, consentimento, observações versionadas, relatórios e pedidos de
privacidade. A UI baixa o JSON com `no-store` somente após validar o SHA-256
dos bytes entregues. O pedido não é marcado como
`fulfilled`, pois a resposta iniciada não comprova download concluído; storage,
expiração persistida e evidência final continuam pendentes.

ADR-062 completa a evidência direta de G1/G7: geração registra recibo mínimo
sem payload; após validar os bytes, o cliente confirma ID e SHA-256. Recibo,
transição para `fulfilled`, evento e auditoria são vinculados e atômicos no
PostgreSQL. A evidência comprova recebimento pelo cliente, não leitura humana.

G1/G3/G7 em API condicionada: POST/GET de solicitações de privacidade exigem autenticação, conta ativa, ownership, idempotência e validação runtime; o servidor deriva titular e estado. Sem referência explícita da política de retenção, novas criações são bloqueadas, mas status existente permanece legível. ADR-034 está aceita; identidade/política de produção, UI, verificação e fulfillment continuam pendentes.

H5 em API/UI condicionada: POST/listagem de suporte exigem autenticação, conta ativa, idempotência, categoria controlada, ownership e cursor opaco; texto livre e campos adicionais são rejeitados. A interface lista os próprios pedidos, pagina e a atualiza após criação válida. Sem referência explícita de retenção, novas entradas são bloqueadas, mas registros existentes permanecem legíveis. ADR-035 e ADR-040 estão aceitas; roteamento, operador, triagem, SLA e fornecedor continuam pendentes.

G1/G3/G7/H5 em UI condicionada: a área de privacidade e suporte consulta sessão real antes de renderizar formulários; envia somente tipo/categoria e idempotência e valida respostas pelos contratos compartilhados. ADR-036 está aceita; login de produção, histórico completo, consentimentos e operação de suporte continuam pendentes.

G4 em API: histórico autenticado lista decisões append-only com chave, título, texto e versão imutável da finalidade, usando ownership, limite fechado e cursor opaco. ADR-037 está aceita; finalidades, decisões reais, grant/revoke e reconsentimento continuam pendentes.

G4 em UI: após sessão válida, a área de privacidade mostra finalidade, texto, versão, decisão e data do histórico, valida o contrato e pagina pelo cursor opaco. ADR-038 está aceita; publicação, grant/revoke e reconsentimento reais continuam pendentes.

G7 em API/UI: listagem própria de solicitações de privacidade usa ownership, limite fechado e cursor opaco; a interface mostra tipo e estado sem eventos internos e a atualiza após criação válida. ADR-039 está aceita; verificação, transições e fulfillment continuam pendentes.

G7 em API/UI: histórico próprio de solicitação expõe e apresenta somente transições e tempos append-only, após ownership, sem códigos internos, identidades ou detalhes de fulfillment. ADR-041 está aceita; verificação, transições e fulfillment continuam pendentes.
