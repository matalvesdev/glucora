# ADR-063: confirmação idempotente da entrega de exportação

Status: ACCEPTED

## Contexto

O cliente pode receber a resposta de confirmação depois de o servidor concluir
a transação, mas perder essa resposta por falha de rede. Repetir a mesma
confirmação não pode criar uma segunda transição, evento ou auditoria, nem
converter uma entrega válida em conflito.

## Decisão

A confirmação é idempotente somente quando pedido, titular, ID opaco do recibo
e SHA-256 correspondem ao mesmo recibo já `acknowledged` e o pedido está
`fulfilled`. Nesse caso, a API devolve o estado persistido sem nova escrita.

Qualquer divergência, recibo ausente, combinação parcial de estados ou outro
estado do pedido continua falhando de modo seguro. A primeira confirmação
mantém recibo, transição, evento e auditoria na mesma transação.

Aceita por Mateus Alves Bassane em 2026-09-28, evidência `00001`.
