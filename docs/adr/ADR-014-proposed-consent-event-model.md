# ADR-014: modelo de eventos de consentimento

Status: **ACCEPTED**

## Contexto

O Source of Truth exige consentimento específico, granular, versionado, revogável e reconstruível. Finalidades, bases legais, textos, responsáveis e retenção ainda dependem de decisão de Compliance.

## Decisão proposta

Representar cada finalidade como uma versão com estado `draft`, `published` ou `retired`. Registrar decisões do usuário como eventos imutáveis `granted`, `denied` ou `revoked`. A concessão só pode apontar para uma versão publicada e vigente. O estado atual será derivado da ordem dos eventos, preservando a evidência histórica.

Esta proposta não cadastra finalidades reais, não escolhe bases legais e não publica texto de consentimento. Esses dados só entram após revisão e aceite documentados de Compliance.

## Consequências

- concessões para rascunhos são bloqueadas no banco;
- eventos não podem ser atualizados ou removidos;
- repetição segura usa uma chave de idempotência por usuário e versão;
- uma nova versão exige uma nova decisão explícita quando aplicável;
- expiração automática e política de retenção aguardam decisão normativa.

## Critérios para aceite

- Compliance aprova finalidades, bases legais, textos e retenção;
- Security revisa privilégios de banco e trilha de auditoria;
- Product aprova o fluxo de concessão e revogação;
- testes demonstram publicação obrigatória, imutabilidade e reconstrução.
