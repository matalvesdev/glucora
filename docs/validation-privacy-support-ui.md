# Validação da interface de privacidade e suporte

Escopo: G1/G3/G7/H5, superfície web responsiva.

- Sem autenticação, formulários não são renderizados.
- Com `/v1/me` válido, pedidos de privacidade e suporte ficam disponíveis.
- Requests contêm somente tipo/categoria e idempotência; não enviam titular ou texto livre.
- Respostas da API são validadas pelos contratos TypeBox compartilhados.
- Estados de loading, sucesso, indisponibilidade e erro usam mensagens seguras.
- E2E cobre viewport móvel, ausência de sessão e submissões sintéticas.

Validação: `pnpm check` e `pnpm test:e2e`.

Limite: login de produção, histórico completo, consentimentos e operação de suporte continuam pendentes. ADR-036 permanece PROPOSED.
