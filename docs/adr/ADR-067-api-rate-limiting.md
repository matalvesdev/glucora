# ADR-067: rate limiting da API do MVP

Status: ACCEPTED

## Contexto

O CodeQL da ADR-066 identificou ausência de limitação de requisições como
achado de severidade alta em todas as rotas da API. H6 exige tratar achados
críticos ou altos antes do beta, e o sandbox gratuito não possui uma camada de
edge aprovada para esse controle.

## Decisão

Aplicar rate limiting global no Fastify com `@fastify/rate-limit`, limitado a
120 requisições por minuto por endereço observado pela instância. Somente
`/v1/health` e `/v1/ready` ficam isentos para preservar os probes operacionais.
Excessos passam pelo error handler seguro e não registram URL, corpo, headers
ou dados de saúde. O comportamento possui teste com janela e limite reduzidos.

O contador em memória atende ao sandbox e ao processo modular atual. Ele não é
um controle distribuído entre réplicas e não autoriza produção: o deploy GCP
deve adicionar proteção de borda e revisar confiança em proxies, capacidade,
limites por operação e resposta a abuso antes de receber dados reais.

Aceita por Mateus Alves Bassane em 2026-09-28, evidência `00001`.
