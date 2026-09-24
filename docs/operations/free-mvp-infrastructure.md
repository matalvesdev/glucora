# Infraestrutura gratuita do MVP

Este desenho é apenas para `sandbox-synthetic-only`.

| Camada     | Serviço                  | Uso                     | Limite                          |
| ---------- | ------------------------ | ----------------------- | ------------------------------- |
| Código/CI  | GitHub público + Actions | revisão, testes e build | sem dados de saúde em artefatos |
| Web        | Cloudflare Pages         | bundle Vite estático    | somente frontend; API separada  |
| API        | Render Free Web Service  | Fastify; deploy manual  | hiberna após 15 min; 512 MB     |
| Banco      | Supabase Free            | PostgreSQL canônico     | 500 MB; sem backup automático   |
| Identidade | Google Identity Platform | email/social sem SMS    | adapter OIDC; cota gratuita     |

Esta infraestrutura não é apta para dados reais, beta clínico ou exportação de
saúde. O `render.yaml` descreve a API e mantém o deploy automático desligado.
Não há credenciais nem projetos externos criados pelo repositório.

No primeiro provisionamento do Blueprint, o responsável fornece
`DATABASE_URL` e `IDENTITY_PLATFORM_PROJECT_ID` no painel do Render. O start
executa as migrações versionadas e só então inicia a API; `/v1/ready` impede a
promoção de uma instância sem PostgreSQL disponível.

Limites verificados em 2026-09-24 nas páginas oficiais do
[Render](https://render.com/docs/free),
[Supabase](https://supabase.com/pricing) e
[Identity Platform](https://cloud.google.com/identity-platform/pricing).
