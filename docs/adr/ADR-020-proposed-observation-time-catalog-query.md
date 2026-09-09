# ADR-020: contexto temporal, catálogo e consulta canônica

Status: **PROPOSED**

## Decisão proposta

Cada observação preserva UTC, zona IANA e offset aplicável no instante registrado. O domínio verifica a coerência entre os três valores, inclusive mudanças históricas de horário. Tipo e unidade são autorizados por um catálogo injetável que nega combinações ausentes; nenhum catálogo clínico é embutido nesta proposta.

A consulta canônica retorna somente versões correntes do próprio usuário, em ordem decrescente por `occurred_at` e ID, com cursor keyset e limite máximo de 100.

## Migração

Como não existem dados de produção, a migration exige tabela vazia. Se encontrar registros, falha explicitamente e exige backfill revisado, evitando atribuir timezone presumido a dados existentes.

## Limites

Apresentação local, catálogo glicêmico e endpoints permanecem pendentes de Product, Clinical e Compliance.
