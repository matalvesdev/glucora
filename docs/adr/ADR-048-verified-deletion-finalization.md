# ADR-048: finalização interna de exclusão verificada

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-15, com evidência `00001`.

O serviço interno pode finalizar um pedido somente após reler os recibos persistidos,
reconciliar todos os targets explícitos e construir a transição atribuída ao sistema.
Evidência incompleta ou conflito de versão falha sem transição. Não há endpoint
público, cron, credencial de operador ou escolha de fornecedor neste slice.
