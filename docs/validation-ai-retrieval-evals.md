# Validação da fundação de retrieval e evals de IA

Escopo: F3/F7, somente contratos e dados sintéticos.

- Retrieval exige versão exata e metadados de aprovação, fonte, autoridade, jurisdição e revisão.
- Resultados acima do limite, com versão diferente ou metadados inválidos falham de forma fechada.
- Texto recuperado permanece no documento como dado; `EvidenceRef` expõe somente identificação, versão e autoridade.
- Suites versionadas exigem as seis categorias definidas na Source of Truth.
- Relatórios de eval contêm somente ids, contagens e códigos de falha, sem copiar output bruto ou canários de privacidade.

Execução reproduzível: `pnpm ai:eval` e `pnpm check`.

Limite: não existe corpus, adapter, provider, capability real, threshold clínico nem aprovação de release. ADR-030 permanece PROPOSED.
