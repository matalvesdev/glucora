# ADR-039: listagem própria de solicitações de privacidade

Status: PROPOSED

## Contexto e proposta

O usuário podia criar ou consultar um pedido apenas conhecendo seu id. Propõe-se uma listagem autenticada e paginada em `GET /v1/privacy-requests`, filtrada pelo titular da sessão e ordenada por criação. A UI mostra o tipo e o estado atual do workflow, com paginação pelo cursor opaco retornado pela API.

A rota não revela eventos internos, reason codes ou pedidos de outros titulares. A listagem permanece disponível para pedidos existentes mesmo quando a criação estiver suspensa por falta de política configurada.

## Consequências

O acompanhamento do direito fica utilizável no produto. Verificação, transição de estados, fulfillment e explicação operacional do resultado continuam dependentes dos gates aprovados.
