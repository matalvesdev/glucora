# ADR-017: núcleo canônico de observações quantitativas

Status: **ACCEPTED**

## Contexto

O registro longitudinal precisa preservar significado, unidade, temporalidade, origem, provenance e classe factual antes de oferecer captura, timeline ou insights. Conversões e interpretações implícitas podem causar perda semântica e risco clínico.

## Decisão proposta

Representar uma observação quantitativa com identificadores opacos, código tipado, valor decimal em texto, unidade codificada, quatro tempos UTC, fonte, provenance, classe factual, status e versão.

O domínio valida forma e consistência estrutural. Ele não define faixas clínicas, não converte unidades e não atribui significado terapêutico. `INFERENCE` é rejeitada como medição canônica original.

## Limites

Esta etapa não persiste observações, não expõe endpoint e não escolhe catálogo clínico ou unidade de glicemia. C2–C8 completarão captura, contexto, provenance persistida, correção, timezone, validação de catálogo e consultas.

## Critérios para aceite

- Clinical aprova os códigos, unidades e limites aplicáveis à captura;
- Data aprova semântica temporal e de provenance;
- Security/Privacy aprovam purpose e autorização antes da persistência;
- testes cobrem precisão, timestamps, unidade, provenance e classe factual.
