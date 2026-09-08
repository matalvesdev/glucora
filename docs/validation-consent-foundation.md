# Validação da fundação de consentimento

Escopo: modelo técnico B4/B5 sem finalidade, base legal ou texto real.

- migrations: aplicação repetível, checksum e rollback no PostgreSQL real;
- publicação: concessão aceita somente para versão publicada e vigente;
- imutabilidade: conteúdo publicado e eventos não podem ser alterados;
- histórico: concessão e revogação permanecem ordenadas e reconstruíveis;
- idempotência: repetição idêntica retorna o evento anterior e colisões são rejeitadas;
- dados: fixtures exclusivamente sintéticas no banco isolado de teste.

O resultado não autoriza coleta ou tratamento. ADR-014 permanece `PROPOSED` até os aceites registrados.
