# Infraestrutura gratuita do MVP

Este desenho é apenas para `sandbox-synthetic-only`.

| Camada | Serviço | Uso | Limite |
|---|---|---|---|
| Código/CI | GitHub público + Actions | revisão, testes e build | sem dados de saúde em artefatos |
| Web | Cloudflare Pages | bundle Vite estático | somente frontend; API separada |
| API | processo local ou runner temporário | Fastify e domínio | sem exposição pública por padrão |
| Banco/Auth | Supabase Free | PostgreSQL/Auth compatíveis | dados sintéticos; limites do plano |

Esta infraestrutura não é apta para dados reais, beta clínico ou exportação de
saúde. Não há credenciais, projeto Supabase, projeto Cloudflare ou workflow de
deploy configurados neste repositório.
