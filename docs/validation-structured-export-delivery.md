# Validação da entrega de exportação estruturada

Escopo: ADR-061, E5 e G1.

- contrato OpenAPI para `POST /v1/privacy-requests/{id}/export`;
- autenticação recente de até dez minutos, conta ativa e ownership;
- transição auditada para `in_review` e repetição sem nova transição;
- adapters PostgreSQL parametrizados pelo titular;
- JSON versionado, determinístico, com versões e provenance;
- `Cache-Control: no-store` e filename com ID opaco;
- interface oferece download somente em estados elegíveis;
- testes sintéticos cobrem sucesso e autenticação antiga.

Storage, expiração persistida, confirmação de download e transição para
`fulfilled` continuam fora desta validação. Nenhum dado real foi usado.
