# ADR-029: gate executável para private beta

Status: ACCEPTED

## Contexto e proposta

H8/H9 exige impedir enrollment baseado apenas em código verde. Propõe-se documento versionado com gates Product, Clinical, Compliance, Security e Operations. Cada PASS exige owner e evidência; PASS WITH CONDITIONS também exige condição e prazo válidos. Enrollment é decisão explícita separada e só resulta em readiness quando todos os gates são aceitáveis.

O CI executa `--expect-hold`, que falha se enrollment for ligado prematuramente. Um pipeline futuro de promoção deve executar o modo estrito, que falha enquanto qualquer requisito estiver ausente.

## Consequências

Build, testes e restore não podem ser confundidos com aprovação humana. Referências e owners reais precisam ser incluídos pelas autoridades competentes; este ADR não aceita gates nem habilita beta.
