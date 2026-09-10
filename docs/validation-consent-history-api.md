# Validação da API de histórico de consentimentos

Escopo: G4, leitura própria e paginada.

- Identidade e conta ativa são obrigatórias.
- Repository filtra sempre por `user_id` e une conteúdo da versão imutável da finalidade.
- Resposta expõe decisão, timestamps, chave/título/texto/versão da finalidade.
- Canal interno e chave de idempotência não são expostos.
- Paginação usa limite fechado e cursor opaco validado.
- PostgreSQL real cobre ordenação, página seguinte e isolamento entre usuários.

Validação: `pnpm check`, `pnpm test:integration` e checks remotos.

Limite: nenhuma finalidade ou decisão real é criada por este slice. ADR-037 permanece PROPOSED.
