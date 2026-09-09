# Validação — backup e restore local

- Dump usa formato custom do PostgreSQL, sem owner/ACL, e possui SHA-256.
- Restore ocorre em database isolado com nome validado e cleanup automático.
- Verificação compara o ledger de migrations e confirma schemas/tabelas críticos.
- CI executa o drill e publica somente manifesto sem payload.
- A evidência registra duração sem alegar RPO/RTO aprovado.
