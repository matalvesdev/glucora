# ADR-021: fundação de eventos contextuais

Status: ACCEPTED

## Contexto e proposta

C3 exige alimentação, atividade, sono, sintomas e observações controladas sem transformar ausência em fato ou inferência em declaração original. Propõe-se um registro canônico comum, versionado e temporal, cuja categoria é um código validado por catálogo injetado. Texto opcional fica limitado a 500 caracteres e não recebe interpretação clínica.

O catálogo real e os campos estruturados por categoria dependem de aprovação de Product/Clinical/Compliance. Até lá não há endpoint nem categorias ativadas. Eventos derivados não entram nesta tabela; pertencem a projeções ou registros derivados com provenance explícita.

## Consequências

A fundação preserva ownership, provenance, timezone e classe factual, e permite projeções futuras sem fazer da timeline a fonte canônica. Correção de eventos, retenção e finalidade real continuam bloqueadas e exigem slices posteriores.
