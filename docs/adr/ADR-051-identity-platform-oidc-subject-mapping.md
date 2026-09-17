# ADR-051: identidade OIDC e vínculo de sujeito externo

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-17, com evidência `00001`.

## Contexto

A ADR-050 escolhe o Identity Platform como provedor OIDC de produção, mas o
domínio usa identificadores internos `usr_…`. O `sub` de um token válido não é
uma autorização para acessar uma conta interna e não pode ser tratado como tal.

## Decisão

O adapter de produção aceitará apenas ID tokens do Identity Platform enviados
como `Authorization: Bearer`, verificados por assinatura RS256 e pelas claims
`kid`, `aud`, `iss`, `sub`, `iat`, `exp` e `auth_time`. `aud` será o project ID
configurado e `iss` será `https://securetoken.google.com/<project-id>`.

O adapter resolverá o `sub` em um vínculo imutável e único de provedor+sujeito
para uma conta interna. A ausência, ambiguidade, conta inativa, token inválido
ou indisponibilidade de chaves nega autenticação. Nenhuma claim, inclusive
papéis customizados, concede por si só autorização de dados de saúde.

O provisionamento do vínculo não terá endpoint público neste slice. Ele exige
um fluxo de conta e verificação aprovado antes de ser habilitado. O adapter de
desenvolvimento continua exclusivo de `development` e `test`.

## Controles

- tokens, headers e payloads JWT não são registrados;
- chaves públicas remotas respeitam cache e falhas negam acesso;
- o adapter retorna somente a identidade interna de consumidor;
- ownership, finalidade e consentimento continuam verificados no servidor;
- migrations mantêm apenas provider, subject opaco, conta e tempos, sem
  credenciais ou dados clínicos.

## Alternativas

Usar o `sub` como `user_id` interno foi rejeitado por conflitar com a
taxonomia atual e impossibilitar reconciliação controlada. Confiar em papéis do
token para saúde foi rejeitado pela política deny-by-default. Manter somente o
header de desenvolvimento foi rejeitado para produção pela ADR-050.

## Limites

Esta decisão não cria projeto, usuários, domínios autorizados, provedores de
login, cookies, tokens customizados, credenciais, vínculos de identidade ou
rotas públicas de provisionamento. A configuração do Identity Platform e os
testes contra o ambiente de produção permanecem gates de release.
