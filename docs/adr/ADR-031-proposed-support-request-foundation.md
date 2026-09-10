# ADR-031: fundação de solicitações de suporte

Status: ACCEPTED

## Contexto e proposta

H5 e o critério de MVP exigem um ponto de entrada de suporte, mas identidade privilegiada, ferramenta de atendimento, SLAs e responsáveis de produção permanecem abertos. Propõe-se registrar solicitações do próprio consumidor em PostgreSQL com categoria controlada, idempotência e auditoria atômica. Texto livre, payload clínico, anexos e acesso de operador não fazem parte deste slice.

Os registros são append-only e consultas exigem `user_id`. A única situação inicial é `submitted`; triagem e resolução serão adicionadas quando Operations, Security e Compliance aprovarem papéis, reason codes, SLAs e rota de escalonamento.

## Consequências

O produto ganha um boundary persistente e minimizado para o ponto de entrada sem conceder acesso de suporte a dados de saúde. Este slice não constitui uma operação de atendimento pronta nem satisfaz sozinho o gate H5.
