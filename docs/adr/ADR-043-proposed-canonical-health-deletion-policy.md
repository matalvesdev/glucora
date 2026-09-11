# ADR-043: política de exclusão canônica de dados de saúde

Status: **PROPOSED**

## Contexto

A ADR-042 exige eliminar dados de saúde dos sistemas ativos em até 30 dias após revogação ou pedido de exclusão, salvo bloqueio jurídico documentado. A ADR-032 fornece somente o boundary para receber recibos de targets; ela não classifica quais registros canônicos podem ser apagados nem quais evidências devem ser conservadas.

O PostgreSQL atual protege observações, eventos contextuais e provenance contra exclusão direta para preservar correção e proveniência. Portanto, habilitar um adapter canônico sem uma regra explícita criaria uma exceção silenciosa à imutabilidade e poderia apagar evidência mínima necessária para atender direitos ou obrigação legal.

## Decisão proposta

Para uma solicitação `deletion` autenticada, verificada e em revisão, o executor canônico deve operar numa única transação e produzir um recibo sem payload:

- remover do sistema ativo as observações, eventos contextuais, provenance e projeções pertencentes exclusivamente ao titular;
- remover eventos de consentimento do titular vinculados à finalidade de dados de saúde após registrar a decisão de exclusão;
- conservar solicitações de privacidade, seus eventos e auditoria mínima pelo prazo de cinco anos definido na ADR-042, sem dados de saúde nem texto livre;
- não apagar backups, dados de fornecedores ou artefatos externos neste executor; esses targets devem retornar `retained` ou `pending` com referência de política até que seus adapters e ciclos de expiração estejam implementados;
- registrar no recibo apenas target, resultado, horário e referência opaca de evidência; não incluir contagens, valores, categorias clínicas ou IDs de registros de saúde.

A exclusão só pode concluir como `fulfilled` quando todos os targets forem `deleted` ou `retained` por uma base documentada. Caso exista target `pending` ou `failed`, o pedido permanece em revisão e não é marcado como concluído automaticamente.

## Alternativas consideradas

1. Apagar diretamente todas as tabelas relacionadas ao usuário. Rejeitada: viola triggers de imutabilidade, apaga evidência de direitos e não cobre backups ou subprocessadores.
2. Apenas anonimizar identificadores. Rejeitada: não garante eliminação de dados de saúde nem preserva semântica de proveniência.
3. Manter tudo até decidir a operação completa. Rejeitada: não executa a obrigação de eliminação da ADR-042 no sistema canônico controlado pela Glucora.

## Drivers e riscos

- Privacidade: reduzir dados de saúde ativos após pedido válido.
- Integridade: a exceção à imutabilidade deve ser estreita, transacional e auditável.
- Operação: backups e fornecedores precisam de ciclos e adapters próprios; não podem ser declarados eliminados sem evidência.
- Clínico: não há interpretação, cálculo, diagnóstico ou decisão terapêutica neste fluxo.

## Critérios para aceite

- Compliance confirma a classificação entre dados apagáveis e evidência mínima conservada;
- Security revisa a permissão de execução e o recibo sem payload;
- Operations define evidência e ciclo para backup e subprocessadores;
- testes PostgreSQL comprovam ownership, atomicidade, preservação de auditoria e falha segura.
