# ADR-038: interface de histórico de consentimentos

Status: PROPOSED

## Contexto e proposta

G4 possui leitura autenticada, mas o histórico ainda não aparecia ao titular. Propõe-se carregar `/v1/consents/history` somente após `/v1/me` válido e mostrar título, texto, versão, decisão e data de cada evento. A resposta é validada pelo schema compartilhado e páginas adicionais usam o cursor fornecido pelo servidor.

Sem sessão, a interface não consulta nem mostra histórico. Esta superfície permanece somente leitura; não apresenta grant/revoke até existirem finalidades e políticas aprovadas.

## Consequências

O titular consegue reconstruir as escolhas registradas com seu contexto versionado. Publicação de finalidades, novas decisões, revogação e reconsentimento continuam condicionados aos gates aplicáveis.
