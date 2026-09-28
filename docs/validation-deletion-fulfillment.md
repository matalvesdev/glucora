# Validação do boundary de fulfillment de exclusão

Escopo: G8, orquestração provider-neutral com fixtures sintéticas.

- Somente pedidos de exclusão em revisão podem executar.
- Targets possuem ids únicos e classificação canônica, projeção, vendor ou backup.
- Recibos exigem resultado controlado, reason code, timestamp e evidência quando aplicável.
- Exceções e recibos inválidos viram falhas seguras sem copiar respostas externas.
- O relatório só fica completo quando nenhum target está pendente ou falhou.
- O adapter PostgreSQL de projeção exige pedido `deletion` do mesmo titular em
  `in_review`, remove somente `timeline.items` daquele titular e emite recibo
  controlado sem contagem ou payload.

Validação: `pnpm check`.

Limite: os adapters PostgreSQL canônico e de projeção possuem implementação
real, mas os testes usam somente fixtures sintéticas e ambos permanecem
inacessíveis pela API pública. Vendor, backup, agenda e autorização operacional
continuam sem implementação; a ausência de qualquer recibo impede a conclusão.
ADR-032 e ADR-064 estão aceitas.
