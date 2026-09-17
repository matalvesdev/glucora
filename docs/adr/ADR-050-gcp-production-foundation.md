# ADR-050: fundação de produção no Google Cloud

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-17, com evidência `00001`.

## Decisão

A fundação de produção inicial usará Google Cloud na região
`southamerica-east1` (São Paulo):

- Cloud Run para API web e jobs internos;
- Cloud SQL for PostgreSQL como persistência transacional canônica;
- Cloud Storage para backups e artefatos de exportação, com políticas de
  ciclo de vida separadas por classe de dado;
- Cloud Scheduler para disparar jobs internos autenticados;
- Identity Platform como identidade OIDC de produção;
- Secret Manager para segredos de runtime.

Cloud Scheduler aciona somente endpoints ou jobs privados com identidade de
serviço. Nenhuma execução recebe autorização de saúde por papel administrativo
ou de infraestrutura. Os workers continuam aplicando ownership, finalidade e
consentimento no domínio.

## Limites

Esta decisão não cria projeto, billing account, credenciais, buckets, banco,
usuários, endpoints públicos ou workflow de exclusão ativo. Antes do deploy,
serão exigidos infraestrutura versionada, IAM mínimo, chaves/segredos fora do
repositório, backup/restore no ambiente selecionado, teste de exclusão do
backup, revisão de segurança e gate de release.

## Alternativas consideradas

Manter adapters locais indefinidamente foi rejeitado porque não permite provar
identidade, backup e ciclo operacional de produção. Combinar provedores foi
rejeitado nesta fase para reduzir fronteiras de dados e operação.
