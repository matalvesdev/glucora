# ADR-052: catálogo inicial para captura manual de glicose

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-21, com evidência `00001`.

## Contexto

As ADRs 017, 018 e 020 estabeleceram o modelo canônico, a persistência e a
validação deny-by-default de observações. Elas deliberadamente não escolheram
um código clínico, unidade ou regra de apresentação para glicemia. Sem esse
catálogo, aceitar uma observação pela API ou interface transformaria uma
estrutura técnica em coleta de dado de saúde sem semântica clinicamente
aprovada.

## Decisão

Habilitar inicialmente somente a captura manual de uma medição de glicose do
titular. Mateus Alves Bassane aprovou os parâmetros abaixo em 2026-09-21, com
evidência `00001`:

| Decisão requerida                   | Decisão aceita                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Sistema e código clínico da medição | LOINC `2339-0`, `Glucose [Mass/volume] in Blood`, representado como `http://loinc.org` + `2339-0`.                     |
| Unidade permitida                   | Somente `mg/dL`, representada como `http://unitsofmeasure.org` + `mg/dL`; não há conversão implícita.                  |
| Fonte e método aceitos              | Inserção manual pelo próprio titular de medição capilar declarada pelo usuário, preservada como provenance controlada. |
| Contexto opcional                   | Não aceito nesta versão; não inferir jejum, refeição, exercício, medicação ou sintoma a partir da medição.             |
| Limites e mensagens de segurança    | Não haverá faixas, alertas, interpretação, diagnóstico ou recomendação terapêutica nesta versão.                       |

A implementação ativa somente esse par de tipo/unidade no catálogo versionado
aprovado. O servidor exige conta ativa, ownership, finalidade
`self_care_health_data`, consentimento vigente, idempotência, temporalidade e
provenance. A captura preserva o valor original e não faz conversão implícita.

## Alternativas consideradas

- Embutir `mg/dL` ou um código de glicose escolhido pela engenharia foi
  rejeitado: unidade e código carregam semântica clínica e precisam de
  aprovação explícita.
- Aceitar qualquer tipo/unidade estruturalmente válido foi rejeitado: isso
  viola o catálogo deny-by-default da ADR-020.
- Exibir faixas ou recomendações junto à captura foi rejeitado: amplia o risco
  clínico e conflita com o escopo assistivo do MVP.

## Controles e evidência necessária

- Clinical registra a escolha do código, unidade, método e a ausência de
  limites de apresentação nesta versão;
- Product confirma o fluxo, texto de propósito e estados vazios/erro;
- Compliance/Security confirma a finalidade da ADR-042, consentimento,
  retenção e testes de autorização;
- a decisão aceita identifica responsável, data e evidência; testes usam
  apenas dados sintéticos;
- o contrato OpenAPI, o catálogo e a interface são publicados na mesma
  alteração depois do aceite.

## Limites

Esta decisão não aprova importação de dispositivo, diagnóstico, ajuste de
tratamento ou dose de insulina. Ela habilita somente o endpoint autenticado
descrito acima; interface, timeline e beta continuam sujeitos aos respectivos
gates e critérios de aceite.
