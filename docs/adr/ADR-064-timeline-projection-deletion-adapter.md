# ADR-064: adapter separado para exclusão da timeline

Status: ACCEPTED

## Contexto

O plano obrigatório de G8 distingue dados canônicos de projeções descartáveis e
exige recibo para cada classe. A função canônica também remove a timeline, mas
isso não produz evidência independente do target `projection`.

## Decisão

Criar um adapter PostgreSQL específico para `timeline_projection`. Ele exige um
pedido de exclusão do mesmo titular em `in_review`, bloqueia o pedido durante a
transação, remove somente `timeline.items` daquele titular e devolve recibo
mínimo sem contagem ou payload.

A operação é idempotente quanto ao estado final: uma projeção já vazia continua
considerada eliminada. O adapter não altera o pedido, não apaga dados canônicos
e não substitui os targets de vendor e backup. Esses targets continuam exigindo
evidência própria antes da conclusão.

Aceita por Mateus Alves Bassane em 2026-09-28, evidência `00001`.
