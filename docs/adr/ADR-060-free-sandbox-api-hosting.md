# ADR-060: hospedagem gratuita da API do sandbox

Status: ACCEPTED

## Contexto

A ADR-058 definiu Cloudflare Pages, Supabase Free e GitHub Actions, mas deixou a
API Fastify restrita a processo local ou runner temporário. Isso impedia um
sandbox compartilhado reproduzível.

## Decisão

O sandbox com dados exclusivamente sintéticos usará um Web Service gratuito do
Render para executar a API Fastify. O Blueprint `render.yaml` mantém o deploy
manual, executa as migrações versionadas antes do servidor e verifica
`/v1/ready`. `DATABASE_URL` e `IDENTITY_PLATFORM_PROJECT_ID` são inseridos como
segredos no provisionamento e nunca versionados.

O banco permanece Supabase Free e a identidade usa o adapter já aprovado do
Google Identity Platform. Não será usado login por telefone ou SMS. A aplicação
web permanece no Cloudflare Pages.

O serviço gratuito hiberna após inatividade e pode levar cerca de um minuto
para reiniciar. Ele tem filesystem efêmero, 512 MB de RAM e cota mensal. O
Supabase Free tem 500 MB, não oferece backup automático e pausa após uma semana
sem atividade. Esses limites são aceitos somente para sandbox sintético.

## Limites

O Blueprint não cria contas, projetos, credenciais ou dados. O ambiente não é
produção, não aceita dados reais de saúde e não satisfaz os gates de backup,
restore, SLA, KMS, incident response ou beta clínico. O primeiro deploy exige
revisão dos valores secretos e aplicação manual do Blueprint pelo responsável.

Referências verificadas em 2026-09-24:

- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://supabase.com/pricing
- https://cloud.google.com/identity-platform/pricing

Aceita por Mateus Alves Bassane em 2026-09-24, evidência `00001`.
