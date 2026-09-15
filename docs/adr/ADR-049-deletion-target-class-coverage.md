# ADR-049: cobertura de classes no plano de finalização de exclusão

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-15, com evidência `00001`.

A finalização interna de um pedido de exclusão exige plano explícito com, ao menos,
um target de cada classe: `canonical`, `projection`, `vendor` e `backup`. O domínio
rejeita o plano antes de reler recibos ou alterar o workflow quando uma classe estiver
ausente ou houver identificadores duplicados. Classes podem conter mais de um target;
cada target continua a exigir recibo persistido compatível.

A construção da transição também confere essa cobertura no relatório reconciliado,
impedindo que um chamador interno produza a transição usando um relatório parcial.

Esta regra limita somente a reconciliação e a finalização. Adaptadores isolados podem
ser exercitados separadamente para produzir recibos. Ela não seleciona fornecedor,
armazenamento, agenda, credencial operacional ou endpoint público.
