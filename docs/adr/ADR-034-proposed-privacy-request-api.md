# ADR-034: API de solicitações de privacidade

Status: PROPOSED

## Contexto e proposta

G1/G3/G7 precisam tornar pedidos de acesso, exportação e exclusão exercitáveis. Propõe-se `POST /v1/privacy-requests` e `GET /v1/privacy-requests/{id}` com autenticação, conta ativa, ownership, validação runtime e idempotência. O servidor deriva `user_id`; o cliente nunca escolhe o titular.

A criação falha com 503 enquanto não houver referência explícita da política de retenção. A leitura do status existente continua disponível. O endpoint cria apenas estado `requested`; verificação de identidade, análise e fulfillment permanecem no workflow versionado e não são inferidos pela rota.

## Consequências

O consumidor pode abrir e acompanhar o próprio pedido quando a política estiver configurada. Listagem ampla, documentos de identidade, ações administrativas e dados de outro titular não são expostos.
