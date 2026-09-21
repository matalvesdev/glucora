# ADR-052: catálogo inicial para captura manual de glicose

Status: **PROPOSED**

## Contexto

As ADRs 017, 018 e 020 estabeleceram o modelo canônico, a persistência e a
validação deny-by-default de observações. Elas deliberadamente não escolheram
um código clínico, unidade ou regra de apresentação para glicemia. Sem esse
catálogo, aceitar uma observação pela API ou interface transformaria uma
estrutura técnica em coleta de dado de saúde sem semântica clinicamente
aprovada.

## Decisão proposta

Habilitar inicialmente somente a captura manual de uma medição de glicose do
titular, desde que Clinical aprove todos os campos abaixo em uma revisão
registrada:

| Decisão requerida                   | Estado nesta proposta                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Sistema e código clínico da medição | Em aberto — não usar código local como substituto de classificação clínica aprovada.                                             |
| Unidade ou unidades permitidas      | Em aberto — cada unidade deve ter regra de formato e conversão explicitamente aprovada.                                          |
| Fonte e método aceitos              | Em aberto — delimitar se a primeira versão aceita somente inserção manual pelo titular e qual método pode ser declarado.         |
| Contexto opcional                   | Em aberto — não inferir jejum, refeição, exercício, medicação ou sintoma a partir da medição.                                    |
| Limites e mensagens de segurança    | Em aberto — nenhuma faixa, alerta, interpretação, diagnóstico ou recomendação terapêutica será exibida sem aprovação específica. |

A implementação só poderá ativar pares de tipo/unidade presentes no catálogo
versionado aprovado. O servidor continuará exigindo conta ativa, ownership,
finalidade `self_care_health_data`, consentimento vigente, idempotência,
temporalidade e provenance. A captura preservará o valor original e não fará
conversão implícita.

## Alternativas consideradas

- Embutir `mg/dL` ou um código de glicose escolhido pela engenharia foi
  rejeitado: unidade e código carregam semântica clínica e precisam de
  aprovação explícita.
- Aceitar qualquer tipo/unidade estruturalmente válido foi rejeitado: isso
  viola o catálogo deny-by-default da ADR-020.
- Exibir faixas ou recomendações junto à captura foi rejeitado: amplia o risco
  clínico e conflita com o escopo assistivo do MVP.

## Controles e evidência necessária

- Clinical registra a escolha do código, unidades, método, regras de formato
  e limites de apresentação, se existirem;
- Product confirma o fluxo, texto de propósito e estados vazios/erro;
- Compliance/Security confirma a finalidade da ADR-042, consentimento,
  retenção e testes de autorização;
- a decisão aceita identifica responsável, data e evidência; testes usam
  apenas dados sintéticos;
- o contrato OpenAPI, o catálogo e a interface são publicados na mesma
  alteração depois do aceite.

## Limites

Esta proposta não aprova nenhum código, unidade, faixa, conversão, alerta,
importação de dispositivo, diagnóstico, ajuste de tratamento ou dose de
insulina. Ela não habilita endpoint, interface, coleta pública ou beta.
