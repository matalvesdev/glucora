# Validação da API de suporte

Escopo: H5, criação e listagem própria.

- Rotas exigem identidade e conta ativa.
- POST aceita somente uma das categorias controladas e rejeita texto livre/campos adicionais.
- Ids, titular, timestamp e auditoria são derivados pelo servidor.
- Criação exige idempotência e referência explícita de retenção.
- GET limita resultados, usa somente o titular autenticado e pagina com cursor opaco por criação/id.
- Teste HTTP cobre o cursor seguinte e rejeita cursor malformado.
- OpenAPI deriva dos schemas runtime.

Validação: `pnpm check`, `pnpm test:integration` e checks remotos.

Limite: roteamento, operador, triagem, SLA e fornecedor permanecem pendentes. ADR-035 e ADR-040 permanecem PROPOSED.
