# ADR-053: leitura pública da timeline do próprio titular

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-23, com evidência `00001`.

## Contexto

ADR-022 implementou uma projeção cronológica reconstruível para dados
canônicos, mas preservou a API e a interface públicas como pendentes. Com a
captura e a consulta própria de glicose autorizadas pela ADR-052, uma timeline
pode organizar fatos já permitidos sem criar nova semântica clínica.

## Decisão

Expor uma leitura paginada da timeline somente ao titular autenticado, mediante
conta ativa, ownership e consentimento vigente para `self_care_health_data`.
A leitura usará cursor opaco, filtros fechados por período, origem e categoria,
e agrupará itens pelo dia na zona IANA preservada no fato.

A API não aceita dados de saúde em URL além dos filtros estruturais aprovados,
não registra conteúdo em logs e não interpreta ausência como evento negativo.
A interface mostrará origem, classe factual, instante e categoria codificada;
não exibirá diagnóstico, alerta, faixa, recomendação ou inferência.

## Alternativas consideradas

- Expor a projeção sem validação de finalidade foi rejeitado por violar a
  política deny-by-default.
- Consultar diretamente tabelas canônicas na interface foi rejeitado: a
  timeline deve continuar uma projeção reconstruível.
- Deduzir tendências ou estados clínicos da ausência de itens foi rejeitado.

## Controles e evidências

- Contrato OpenAPI e schemas runtime fechados;
- testes de ownership, consentimento, cursor e ausência de vazamento entre
  titulares;
- teste de timezone e estado vazio sem interpretação;
- logs, métricas e erros sem payload de saúde;
- nenhum compartilhamento, exportação ou acesso por papel administrativo.

## Limites

Esta decisão não aprova categorias clínicas adicionais, importação de
dispositivos, insights, IA, compartilhamento, exportação, alerta clínico ou
beta.
