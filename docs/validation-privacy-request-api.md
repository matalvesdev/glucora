# Validação da API de solicitações de privacidade

Escopo: G1/G3/G7, criação e leitura de status.

- Rotas exigem identidade e conta ativa.
- `user_id`, ids, timestamps, estado inicial e auditoria são derivados pelo servidor.
- POST exige `Idempotency-Key` e body fechado com tipo controlado.
- GET consulta pelo par pedido/titular e responde 404 fora do ownership.
- Ausência da referência de política bloqueia novas criações sem ocultar status já existente.
- OpenAPI é gerado do mesmo runtime schema.

Validação: `pnpm check`, `pnpm test:integration` e checks remotos.

Limite: identidade de produção, política aprovada, UI, verificação e fulfillment permanecem gates. ADR-034 permanece PROPOSED.
