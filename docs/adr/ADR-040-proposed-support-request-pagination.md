# ADR-040: paginação própria de solicitações de suporte

Status: PROPOSED

## Contexto e proposta

A listagem de suporte do titular tinha um limite fixo que podia ocultar pedidos mais antigos. Propõe-se paginação keyset em `GET /v1/support-requests`, ordenada por criação e id, com cursor opaco validado no servidor. A consulta continua filtrada pelo titular autenticado e retorna somente categoria controlada, estado e data.

## Consequências

O acompanhamento permanece utilizável sem tornar a fila de suporte, roteamento, identidade de operador, SLA ou conteúdo adicional públicos. Esses itens seguem condicionados aos gates aplicáveis.
