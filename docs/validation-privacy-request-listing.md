# Validação da listagem de solicitações de privacidade

Escopo: G7, acompanhamento paginado do próprio pedido.

- Repository exige `user_id`, limite fechado e cursor tempo/id válido.
- API exige identidade e conta ativa e valida cursor opaco.
- A resposta inclui somente tipo, estado, versão e tempos necessários ao acompanhamento.
- UI carrega após sessão válida, atualiza a lista após criação bem-sucedida e mostra estados sem expor detalhes internos.
- API de histórico próprio retorna somente transições e tempos, excluindo reason codes internos.
- UI carrega o histórico sob demanda e apresenta somente estados compreensíveis e datas.
- PostgreSQL real cobre isolamento entre titulares.
- Playwright cobre renderização autenticada com dados sintéticos.

Validação: `pnpm check`, `pnpm test:integration` e `pnpm test:e2e`.

Limite: transições e fulfillment continuam pendentes. ADR-039 está aceita.
