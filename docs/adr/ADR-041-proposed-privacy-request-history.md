# ADR-041: histórico próprio de solicitações de privacidade

Status: PROPOSED

## Contexto e proposta

As solicitações de privacidade possuem eventos append-only, mas o titular só consegue consultar o estado atual. Propõe-se uma rota autenticada de histórico por solicitação, filtrada pelo titular e limitada a transição de estado e data. Reason codes, identidades internas, notas e detalhes de fulfillment não são retornados.

## Consequências

O acompanhamento fica mais verificável sem revelar informação operacional. Verificação de identidade, transições, fulfillment e explicações individuais continuam dependentes dos gates aprovados.
