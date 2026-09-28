# ADR-062: recibo mínimo de entrega da exportação

Status: ACCEPTED

## Decisão

Cada exportação gerada registra um recibo sem payload com ID opaco, pedido,
titular, SHA-256, contagem, instante de geração e estado `generated`. Depois de
receber todos os bytes e validar o SHA-256, o cliente confirma o mesmo ID e
digest. PostgreSQL altera o recibo para `acknowledged`, o pedido para
`fulfilled` e grava evento e auditoria na mesma transação.

O recibo é append-only, pertence ao mesmo titular do pedido e não contém dados
clínicos. Digest divergente, ownership divergente ou pedido fora de `in_review`
falham sem transição. A confirmação prova recebimento dos bytes pelo cliente,
não abertura humana do arquivo. A repetição exata passa a seguir a ADR-063.

Aceita por Mateus Alves Bassane em 2026-09-24, evidência `00001`.
