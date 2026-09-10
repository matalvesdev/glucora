# ADR-026: boundary inicial do runtime de IA

Status: ACCEPTED

## Contexto e proposta

F1/F2/F6/F9 precisa materializar ADR-006/007 sem escolher provider. Propõe-se registry explícito por capability e gateway abstrato de geração estruturada. A execução ordena risco, autorização/consentimento, suficiência de evidência, saúde do provider, schema e guard; qualquer falha retorna fallback/abstention específico.

Somente R0/R1 pode completar automaticamente. R2+ é bloqueado. Tools começam vazias e são allowlisted por capability. O trace guarda referências/versões e métricas, nunca prompt, resposta ou contexto bruto.

## Consequências

Providers podem ser adicionados posteriormente sem alterar o contrato de segurança. Nenhuma capability real fica registrada/ativa até bundle, corpus, intended use, owner e eval suite serem aprovados.
