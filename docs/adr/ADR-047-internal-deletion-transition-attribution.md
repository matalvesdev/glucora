# ADR-047: atribuição de transição interna de exclusão

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-15, com evidência `00001`.

Uma transição de exclusão construída a partir de recibos reconciliados é uma
ação do sistema, nunca uma ação do consumidor. Ela só pode ser preparada para
pedido `deletion` em revisão e relatório completo; o evento e a auditoria usam
ator `system` sem identificador pessoal. O adapter que executará a transação,
as credenciais de operador e o agendamento permanecem fora deste slice.
