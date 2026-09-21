# Validação do boundary de fulfillment de exclusão

Escopo: G8, orquestração provider-neutral com fixtures sintéticas.

- Somente pedidos de exclusão em revisão podem executar.
- Targets possuem ids únicos e classificação canônica, projeção, vendor ou backup.
- Recibos exigem resultado controlado, reason code, timestamp e evidência quando aplicável.
- Exceções e recibos inválidos viram falhas seguras sem copiar respostas externas.
- O relatório só fica completo quando nenhum target está pendente ou falhou.

Validação: `pnpm check`.

Limite: nenhum adapter apaga dados reais; plano, retenção, subprocessadores, autorização e transição final aguardam aprovação. ADR-032 está aceita.
