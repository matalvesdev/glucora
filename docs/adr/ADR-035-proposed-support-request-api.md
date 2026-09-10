# ADR-035: API de solicitações de suporte

Status: PROPOSED

## Contexto e proposta

H5 exige um ponto de entrada exercitável sem introduzir texto livre ou acesso privilegiado prematuro. Propõe-se `POST /v1/support-requests` e `GET /v1/support-requests` para consumidor autenticado com conta ativa. A entrada aceita somente categoria controlada, exige idempotência e deriva titular, ids, timestamp e auditoria no servidor.

Novas solicitações falham com 503 sem referência explícita de política de retenção; registros existentes continuam visíveis ao titular. A consulta é limitada e sempre filtra por `user_id`.

## Consequências

O consumidor ganha um canal técnico mínimo e rastreável. Roteamento, notificações, identidade de operador, triagem, SLA e conteúdo adicional continuam condicionados a Operations, Security e Compliance.
