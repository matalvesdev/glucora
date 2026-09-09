# ADR-027: adapter local de backup e restore

Status: PROPOSED

## Contexto e proposta

H2/H3 exige prova de restauração sem escolher cloud, object storage ou KMS. Propõe-se um adapter de operação local baseado nas ferramentas oficiais `pg_dump`/`pg_restore` executadas dentro do container PostgreSQL fixado. O dump custom-format recebe checksum e é restaurado em database isolado; o ledger e schemas críticos são verificados automaticamente.

O CI publica somente o manifesto sem dados. O dump permanece ignorado e efêmero. O script valida o nome do database temporário e nunca apaga/substitui o database canônico.

## Consequências

Cada mudança passa um restore drill reproduzível e mede duração, sem declarar RPO/RTO ou proteção de produção. Scheduling, storage cifrado, KMS, retenção, monitoramento e owner dependem da infraestrutura escolhida e de aprovação Operations/Security.
