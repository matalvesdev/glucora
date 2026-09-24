# ADR-058: infraestrutura gratuita do sandbox MVP

Status: ACCEPTED

## Decisão

Para desenvolvimento compartilhado e piloto com dados sintéticos, o Glucora
usará uma infraestrutura sem custo recorrente:

- GitHub público e GitHub Actions para CI/CD;
- Cloudflare Pages para a aplicação web estática;
- Render Free Web Service para a API Fastify do sandbox, conforme ADR-060;
- Supabase Free somente para PostgreSQL/Auth de sandbox, mantendo a API Fastify
  como camada de domínio e autorização; a autenticação efetiva usa o adapter
  aprovado do Google Identity Platform, não Supabase Auth;
- artefatos de CI somente dentro do limite gratuito do GitHub.

O ambiente é `sandbox-synthetic-only`: não recebe dados reais de saúde, não é
produção e não oferece SLA, backup operacional, KMS, reautenticação de
exportação, fulfillment de direitos ou acesso clínico. Segredos ficam fora do
repositório. As migrações PostgreSQL do projeto continuam sendo a fonte do
esquema.

## Limites e transição

O Render Free hiberna após inatividade e o Supabase Free pausa após uma semana
sem atividade e não inclui backup automático. O banco possui limite de 500 MB.
A migração para a fundação GCP da ADR-050 exige gate operacional, backup/restore,
IAM, KMS, owners e aprovação de release.

Aceita por Mateus Alves Bassane em 2026-09-24, evidência `00001`.
