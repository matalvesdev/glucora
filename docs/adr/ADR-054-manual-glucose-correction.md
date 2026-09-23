# ADR-054: correção de medição manual de glicose pelo titular

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-23, com evidência `00001`.

## Contexto

A ADR-052 permite ao titular registrar manualmente uma medição capilar de
glicose no catálogo único aprovado. A ADR-019 já exige que uma correção seja
versionada e transacional, mas ainda não a expõe no produto.

## Decisão

O titular autenticado poderá corrigir somente uma medição manual corrente da
própria conta, desde que a conta esteja ativa, a finalidade
`self_care_health_data` esteja publicada e o consentimento vigente. A correção
aceita somente o mesmo tipo LOINC `2339-0`, unidade `mg/dL` e método manual
capilar declarado. Ela exige chave de idempotência e versão esperada.

A versão anterior será preservada como `superseded`; a substituta receberá
nova provenance e auditoria na mesma transação. Não haverá apagamento,
conversão, nova categoria, interpretação, faixa, alerta ou recomendação.

## Controles

- ownership e consentimento são verificados antes da persistência;
- conflito de versão ou reutilização incompatível de idempotência não altera
  o registro;
- respostas, logs e métricas não incluem valores de saúde;
- contratos, testes sintéticos e interface serão atualizados no mesmo slice.

## Limites

Esta decisão não aprova correção de contexto, importações, dados de
dispositivo, compartilhamento, exportação, diagnósticos ou beta.
