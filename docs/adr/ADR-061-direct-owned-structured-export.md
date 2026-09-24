# ADR-061: exportação estruturada direta do próprio titular

Status: ACCEPTED

## Contexto

E5/G1 exigem que a exportação seja exercitável. A ADR-033 já aprovou o artefato
determinístico, mas deixou autenticação adicional, entrega, storage e evidência
de download em aberto.

## Decisão

O titular autenticado pode solicitar a geração direta do JSON em
`POST /v1/privacy-requests/{id}/export`. A API exige conta ativa, ownership do
pedido e autenticação ocorrida nos últimos dez minutos. Ausência, timestamp
futuro ou autenticação antiga falham antes de qualquer leitura de dados.

Pedidos `requested` ou `identity_verification_required` avançam para
`in_review` com evento e auditoria atômicos antes da geração. Repetições em
`in_review` regeneram o mesmo formato sem nova transição. A resposta usa
`Cache-Control: no-store`, nome derivado apenas do ID opaco do pedido e o
SHA-256 dos bytes exatos em `X-Glucora-Content-SHA256`. O cliente calcula o
digest recebido e interrompe o download quando houver ausência ou divergência.

Adapters PostgreSQL explícitos exportam conta, consentimentos, todas as versões
de observações com provenance, relatórios de consulta e solicitações de
privacidade. Cada registro declara titular, tipo, versão e referências de
provenance; o agregador rejeita mistura de titulares.

Não há object storage, URL pública, cache de artefato ou persistência do JSON.
O pedido permanece `in_review`: gerar a resposta não prova que o cliente
concluiu o download. Transição para `fulfilled`, evidência de entrega e janela
persistida de sete dias exigem um slice posterior.

## Consequências

O direito de exportação passa a ser exercitável diretamente na interface para
o titular, sem selecionar fornecedor de storage. O adapter de identidade deve
preservar `auth_time`; adapters incapazes de comprová-lo recebem negação.

Aceita por Mateus Alves Bassane em 2026-09-24, evidência `00001`.
