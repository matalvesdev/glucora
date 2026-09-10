# ADR-037: API de histórico de consentimentos

Status: PROPOSED

## Contexto e proposta

G4 exige que o titular consulte decisões anteriores e a versão exata da finalidade. Propõe-se `GET /v1/consents/history`, autenticado e filtrado exclusivamente pelo usuário da sessão. Cada item combina o evento append-only com chave, versão, título e texto imutável da finalidade.

A coleção usa limite fechado e cursor opaco baseado em tempo/id. Canal interno e chave de idempotência não são expostos. A rota é somente leitura e não depende de consentimento vigente para mostrar o próprio histórico.

## Consequências

O histórico fica rastreável e inteligível sem criar uma finalidade real. Publicação de finalidades, grant/revoke pela UI e política de reconsentimento continuam dependentes de Product, Compliance e Clinical quando aplicável.
