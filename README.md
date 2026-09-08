# Glucora

Fundação técnica do MVP, conforme Initiative A (A1–A9). Ainda não é um produto clínico nem uma versão beta.

## Fontes e repositório

- [Glucora — Source of Truth](https://drive.google.com/drive/folders/1GizzPqxv3WGLT2UnfmuIAu2LwFwq_l9-)
- [Repositório privado](https://github.com/matalvesdev/glucora)
- [Plano e critérios de saída](docs/implementation-plan.md)
- [Prompt master](docs/source-of-truth/13-9.md)

Snapshots selecionados do Drive estão em docs/source-of-truth, com URL e data de modificação. A conexão é documental: não há sincronização automática nem dependência de Drive em runtime.

## Desenvolvimento

Requisitos: Node.js 24 LTS, pnpm 10.32.1, Docker com Compose v2.

```sh
corepack enable
corepack prepare pnpm@10.32.1 --activate
pnpm install --frozen-lockfile
pnpm env:init
pnpm db:up
pnpm db:migrate
pnpm dev
```

Se Corepack não estiver disponível, instale pnpm 10.32.1 conforme a documentação oficial.
Web: http://127.0.0.1:5173. API: http://127.0.0.1:3001/v1/health e /v1/ready.
env:init gera credenciais aleatórias locais sem imprimir a senha e preserva arquivos existentes.
.env.example contém somente nomes/comentários; .env.local nunca deve ir para o Git.
A porta PostgreSQL local é 55432. Se já estiver ocupada, encerre a instância Glucora anterior antes de subir Compose.
Em outro ambiente, configure DATABASE_URL em .env.local para PostgreSQL 17 dedicado; a API não depende de Docker.

## Verificação

```sh
pnpm check
pnpm security:secrets
pnpm audit --audit-level high
pnpm exec playwright install chromium
pnpm test:e2e
```

Para integração, defina TEST_DATABASE_URL apontando para uma instância PostgreSQL **de teste**, com permissão CREATEDB, e execute pnpm test:integration. O teste cria e remove exclusivamente seu banco com nome aleatório; ausência de configuração falha o teste.
O CI usa o mesmo PostgreSQL Compose, executa migrations, integração, build e E2E.
Não há seed clínico nesta etapa: a migration cria somente metadados operacionais.
Não há comando de reset destrutivo; recriações de testes usam bancos exclusivos.

## Estrutura

apps/web: React/Vite/Tailwind; services/api: Fastify; packages/contracts: schemas/OpenAPI;
packages/config: env/TypeScript; packages/ui: componente shadcn/ui;
packages/observability: logs mínimos; packages/test-utils: captura de logs;
packages/domain: fronteira reservada para a Iniciativa B; infrastructure: PostgreSQL/migrations.

## Limites

Autenticação, consentimento, registros, timeline e IA ainda não estão implementados.
A API expõe somente probes; demais rotas retornam 404. A checagem de readiness exige banco e baseline de schema.
PWA/offline e cache de dados sensíveis não foram habilitados. Cloud, identity provider e demais provedores continuam em aberto.
Veja docs/operations/local-runbook.md para falha, encerramento e recuperação.
