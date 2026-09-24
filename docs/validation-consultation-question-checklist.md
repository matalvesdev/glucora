# Validação — checklist de perguntas para consulta

Referências: ADR-023, ADR-042, ADR-055 e ADR-056.

O checklist está vinculado a um relatório do próprio titular e aceita somente
`review_records`, `discuss_routine` e `clarify_next_steps`. Criação e remoção
são eventos append-only, idempotentes e auditados; a leitura devolve apenas as
seleções vigentes.

Conta ativa, ownership, finalidade publicada e consentimento vigente são
obrigatórios. Não há texto livre, valores clínicos, diagnósticos,
recomendações, geração por IA, exportação ou compartilhamento.
