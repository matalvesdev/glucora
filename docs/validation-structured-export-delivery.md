# Validação da entrega de exportação estruturada

Escopo: ADR-061, ADR-062, ADR-063, E5, G1 e G7.

- contrato OpenAPI para `POST /v1/privacy-requests/{id}/export`;
- autenticação recente de até dez minutos, conta ativa e ownership;
- transição auditada para `in_review` e repetição sem nova transição;
- adapters PostgreSQL parametrizados pelo titular;
- JSON versionado, determinístico, com versões e provenance;
- `Cache-Control: no-store`, filename com ID opaco e SHA-256 validado pelo
  navegador sobre os bytes recebidos;
- interface oferece download somente em estados elegíveis;
- testes sintéticos cobrem sucesso e autenticação antiga.

Storage, expiração persistida, confirmação de download e transição para
`fulfilled` eram pendências da ADR-061. A ADR-062 adiciona recibo mínimo de
geração e confirmação pelo cliente; confirmação, evento, auditoria e transição
são atômicos. Storage e expiração persistida continuam fora desta validação.
Nenhum dado real foi usado.

A mesma confirmação pode ser reenviada após perda da resposta. O repository
relê e bloqueia pedido e recibo, devolve o estado `fulfilled` já persistido e
não grava uma segunda transição, evento ou auditoria. O teste PostgreSQL conta
explicitamente uma única ocorrência de cada evidência após duas confirmações.
Divergências de titular, pedido, recibo ou SHA-256 continuam falhando.
