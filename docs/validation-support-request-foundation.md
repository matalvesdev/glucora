# Validação da fundação de suporte

Escopo: H5, entrada persistente interna com dados sintéticos.

- Categoria é controlada e não existe campo de texto livre, payload clínico ou anexo.
- Criação é idempotente por consumidor e auditada na mesma transação.
- Reutilização da chave com outro hash falha.
- Listagem exige ownership e tem limite fechado.
- PostgreSQL rejeita alteração ou exclusão do registro append-only.

Validação: `pnpm check` e `pnpm test:integration` com PostgreSQL real.

Limite: endpoint/UI, identidade de operador, triagem, SLA, paging e fornecedor continuam pendentes. ADR-031 permanece PROPOSED.
