# Glucora

Fundação técnica do MVP, conforme a Source of Truth. A base A1–A9 e slices condicionais das iniciativas B–H estão implementados; o produto não deve ser apresentado como sistema clínico autônomo.

## Fontes e repositório

- [Glucora — Source of Truth](https://drive.google.com/drive/folders/1GizzPqxv3WGLT2UnfmuIAu2LwFwq_l9-)
- [Repositório público](https://github.com/matalvesdev/glucora)
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

O adapter de identidade local é exclusivo de desenvolvimento; autenticação e sessões de produção não foram selecionadas. A área de privacidade e suporte exige uma conta local ativa e só aceita operações condicionadas por políticas configuradas; ela não realiza verificação de identidade, fulfillment, triagem ou atendimento por operador.

Os modelos de observação, contexto, timeline, relatórios, compartilhamento, IA e retenção têm fundações provider-neutral e fail-closed, mas captura clínica real, catálogo clínico aprovado, entrega de artefatos, identidade de destinatário, provider de IA e operação humana continuam dependentes das decisões documentadas no plano.

O registro de readiness do beta privado está aprovado e a inscrição foi habilitada com evidências registradas. Isso não seleciona provedores de produção nem substitui os limites clínicos, de privacidade e de compliance da Source of Truth.

PWA/offline e cache de dados sensíveis não foram habilitados. Cloud, identity provider e demais provedores continuam em aberto.
Veja docs/operations/local-runbook.md para falha, encerramento e recuperação.
