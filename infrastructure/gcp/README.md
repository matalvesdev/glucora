# Fundação GCP de produção

Este diretório declara a fundação aceita na ADR-050. O módulo nunca deve ser
aplicado com credenciais pessoais ou em um projeto que contenha dados reais sem
o gate de release e a revisão de segurança exigidos pela ADR.

Por padrão, `enable_resources = false`: `terraform plan` pode revisar a
configuração, mas não cria recursos. Uma aplicação futura exige um arquivo
`*.tfvars` fora do repositório, com `project_id`, `environment`, uma imagem
imutável da API, capacidade/recuperação do banco e a aprovação operacional
registrada.

## Recursos declarados quando explicitamente habilitados

- Cloud Run privado para a API; o job interno de exclusão exige seu próprio
  switch, imagem e gate de revisão;
- Cloud SQL for PostgreSQL, com proteção contra destruição e recuperação
  point-in-time;
- buckets separados para exportações e backups, sem acesso público e sem
  destruição forçada;
- contas de serviço distintas para runtime, job e Scheduler;
- Secret Manager somente para o identificador do segredo de conexão;
- Cloud Scheduler com OIDC, também desligado até que cron, alvo privado e
  audiência sejam revisados.

O módulo não grava versões de segredos, não adiciona IAM público, não cria
domínios autorizados nem habilita fluxos de identidade. A configuração de
usuários, domínios e provedores do Identity Platform permanece um gate de
segurança e produto. A API continua responsável por autorização, finalidade e
consentimento: IAM de infraestrutura não concede acesso a dados de saúde.

## Revisão local

```powershell
pnpm infra:check
terraform -chdir=infrastructure/gcp fmt -check
terraform -chdir=infrastructure/gcp init -backend=false
terraform -chdir=infrastructure/gcp validate
```

O repositório não inclui credenciais, IDs de projeto, nomes de bucket,
connection strings ou arquivos `*.tfvars`. Use apenas o arquivo de exemplo
como referência e mantenha valores de ambiente fora do Git.

Antes de qualquer `apply`, conclua os itens de limite da ADR-050: IAM de menor
privilégio, segredos no Secret Manager, teste de restore, teste de exclusão de
backup, revisão de segurança e gate de release.
