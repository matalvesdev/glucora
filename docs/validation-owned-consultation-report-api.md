# Validação — relatório próprio de preparação de consulta

Referências: ADR-023, ADR-042, ADR-053 e ADR-055.

`POST /v1/consultation-reports` cria um snapshot determinístico para um
período explícito. Antes da composição, reconstrói a timeline do próprio
titular; o snapshot preserva somente contagens, período, limitações e
referências internas de versão. `GET /v1/consultation-reports/:id` mantém a
consulta limitada ao titular.

- conta ativa, ownership, finalidade publicada e consentimento vigente são
  obrigatórios;
- período futuro ou inválido é rejeitado;
- criação usa idempotência, provenance de origem/versionamento e auditoria
  transacional já definidos pela ADR-023;
- respostas e interface não expõem valores de medição, notas, diagnósticos,
  alertas, recomendações, exportação ou compartilhamento.

Cobertura automatizada: teste HTTP de composição a partir de timeline
reconstruída, contrato OpenAPI/runtime e validações completas de repositório
em PostgreSQL pelo CI.
