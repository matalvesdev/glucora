# ADR-024: workflow de solicitações de direitos do titular

Status: PROPOSED

## Contexto e proposta

G1/G3/G7 e Compliance 08.4 exigem request, verificação, escopo, decisão, resposta, fulfillment e exceções rastreáveis. Propõe-se um estado atual com versão otimista e histórico append-only para solicitações de acesso, exportação e exclusão. A criação é idempotente e toda mudança relevante gera auditoria na mesma transação.

O sistema não define prazo legal, não presume que toda exclusão seja permitida e não marca fulfillment antes dos adapters de dados, subprocessadores e backups confirmarem seus resultados. `partially_fulfilled` e `denied` exigem reason code controlado, sem texto livre no audit trail.

## Consequências

O workflow pode ser operado e medido sem guardar documentos de identidade ou payload de saúde. Política de verificação, SLA, reason codes finais, export artifact e hooks de fornecedores permanecem dependências de Compliance/Operations.
