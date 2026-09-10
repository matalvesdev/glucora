# ADR-030: retrieval aprovado e evals versionados

Status: ACCEPTED

## Contexto e proposta

F3/F7 precisam aplicar o ADR-007 sem selecionar corpus, mecanismo de busca ou provider. Propõe-se um port de retrieval que exige versão do corpus e devolve documentos com fonte, nível de autoridade, jurisdição, datas de publicação/revisão e referência de aprovação. A validação falha quando a versão, o limite ou os metadados não satisfazem o contrato. O conteúdo recuperado permanece dado e não concede instruções nem ferramentas.

Propõe-se também um harness provider-neutral para suites versionadas. Toda suite deve conter casos normal, edge, adversarial, abstention, privacy e clinical boundary. O relatório persiste apenas identificadores e códigos de falha; entradas e saídas brutas ficam fora do artefato.

## Consequências

Corpus e mecanismos reais podem ser avaliados depois sem alterar o boundary de segurança. Nenhuma capability passa ao usuário somente por executar este harness: bundle, corpus, critérios/thresholds e aprovações aplicáveis ainda precisam ser definidos e aceitos.
