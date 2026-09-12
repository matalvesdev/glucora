# ADR-046: vínculo verificável entre recibo retido e bloqueio jurídico

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-12, com evidência `00001`.

## Decisão

Um recibo com resultado `retained` deve conter `legal_hold_ref`, usar somente o
código `legal_hold_documented` e apontar para um ledger do mesmo titular. O
orquestrador interno consulta os eventos desse hold e aceita a retenção somente
se o último evento aplicável estiver ativo, dentro da vigência documentada e
com o motivo controlado. Falhas, hold ausente, liberado ou vencido mantêm o
pedido incompleto. Recibos dos demais resultados não carregam essa referência.

O slice não transiciona a solicitação, não escolhe executor, operador, fila,
backup ou fornecedor, e não ativa captura pública.
