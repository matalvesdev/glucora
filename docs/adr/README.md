# Decisions

Accepted ADR-001 through ADR-012 are preserved as sourced snapshots under ../source-of-truth/. ADR-013 through ADR-041 were accepted by Mateus Alves Bassane on 2026-09-10, with evidence reference `00001`.
See ../source-of-truth/12-2.md for the decision register.
Cloud/region, identity, queues, object storage, observability provider, KMS, AI provider and other listed strategic decisions remain OPEN where an accepted ADR intentionally preserves that choice for a later decision.
Before a new material change, create a PROPOSED ADR with context, alternatives, drivers, risks, owner and evidence; do not treat it as accepted.

ADR-042 define as finalidades, bases legais e retenções iniciais para o Brasil. Foi aceito por Mateus Alves Bassane em 2026-09-11, com evidência `00001`.
ADR-043 define a classificação e a execução canônica de exclusão necessária para cumprir a ADR-042. Foi aceita por Mateus Alves Bassane em 2026-09-11, com evidência `00001`.

ADR-044 define o ciclo operacional, bloqueios jurídicos e critérios de conclusão da retenção e exclusão. Foi aceita por Mateus Alves Bassane em 2026-09-12, com evidência `00001`; ela não aprova fornecedor, operador ou mecanismo de produção.
No new strategic decision is introduced by Initiative A.

ADR-050 seleciona a fundação GCP e ADR-051 define a verificação OIDC do Identity Platform e o vínculo entre sujeito externo e conta interna. Ambas foram aceitas por Mateus Alves Bassane em 2026-09-17, com evidência `00001`; nenhuma delas cria recursos, credenciais, usuários ou fluxos públicos.

ADR-052 foi aceita por Mateus Alves Bassane em 2026-09-21, com evidência
`00001`, para LOINC `2339-0`, `mg/dL`, inserção manual capilar declarada pelo
titular e ausência de faixas ou alertas. Ela habilita apenas a captura
autenticada e idempotente condicionada ao consentimento; interface, timeline e
beta continuam em seus próprios gates.

ADR-053 foi aceita por Mateus Alves Bassane em 2026-09-23, com evidência
`00001`, para a leitura paginada da timeline do próprio titular, condicionada
a finalidade publicada e consentimento vigente. Ela não aprova categorias
clínicas adicionais, compartilhamento, exportação, alertas ou beta.

ADR-054 foi aceita por Mateus Alves Bassane em 2026-09-23, com evidência
`00001`, para a correção idempotente e versionada de medição manual de glicose
pelo próprio titular.

ADR-060 foi aceita por Mateus Alves Bassane em 2026-09-24, com evidência
`00001`, para hospedar a API do sandbox sintético em Render Free por um
Blueprint de aplicação manual. A decisão não autoriza dados reais ou produção.

ADR-061 foi aceita por Mateus Alves Bassane em 2026-09-24, com evidência
`00001`, para entregar exportação JSON diretamente ao titular após autenticação
recente, ownership e transição auditada para revisão.

ADR-062 foi aceita por Mateus Alves Bassane em 2026-09-24, com evidência
`00001`, para registrar geração e confirmação de recebimento por checksum antes
da transição atômica do pedido de exportação para `fulfilled`.

ADR-063 foi aceita por Mateus Alves Bassane em 2026-09-28, com evidência
`00001`, para tornar a repetição exata da confirmação de entrega idempotente,
sem duplicar transição, evento ou auditoria.

ADR-064 foi aceita por Mateus Alves Bassane em 2026-09-28, com evidência
`00001`, para separar a exclusão da timeline descartável em um adapter de
projeção com autorização e recibo próprios.
