# ADR-045: ciclo verificável de bloqueio jurídico

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-12, com evidência `00001`.

## Contexto

A ADR-044 exige motivo, titular, responsável, início, revisão e expiração para
reter dados além do prazo padrão. O primeiro ledger append-only registrava a
aplicação ou liberação, mas não permitia avaliar o prazo de revisão nem o fim
do bloqueio. Recibos de exclusão permanecem fail-closed até que um executor
vincule cada retenção a um bloqueio ativo; nenhum pedido será concluído por
esta decisão.

## Decisão

Cada evento do ledger de bloqueio jurídico preservará `review_at` e
`expires_at` em UTC, além de `occurred_at`. Os dois marcos devem ser posteriores
ao início, e a expiração deve ser posterior à revisão. Eventos continuam
append-only, usam somente referências opacas e códigos controlados, e são
consultados por titular e referência de bloqueio.

Um bloqueio só pode futuramente justificar a retenção se estiver aplicado e
não estiver vencido no instante avaliado. A ligação entre um recibo de target e
um bloqueio, a qualificação do executor, transição para `fulfilled` e o ciclo
agendado seguem pendentes de slice próprio. Não é aprovado fornecedor, fila,
agendador, armazenamento, operador ou subprocessador de produção.

## Alternativas consideradas

1. Inferir revisão e expiração a partir de texto ou da data de criação. Rejeitada:
   não produz evidência verificável e introduz interpretação implícita.
2. Permitir retenção com um código e uma referência opaca sem vigência. Rejeitada:
   não atende aos critérios da ADR-044.
3. Concluir pedidos quando houver qualquer hold histórico. Rejeitada: um hold
   liberado ou vencido não autoriza retenção atual.
