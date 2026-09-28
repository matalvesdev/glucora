# ADR-065: monitor gratuito de saúde do sandbox

Status: ACCEPTED

## Contexto

O sandbox da ADR-058 usa Render Free e pode hibernar. A API já separa liveness
de readiness, mas não existe verificação externa programada. H1 exige detectar
indisponibilidade sem incluir payloads de saúde, credenciais ou URLs nos logs.

## Decisão

Usar GitHub Actions, já aprovado para o sandbox, para consultar a cada quinze
minutos `/v1/health` e `/v1/ready`. O monitor exige HTTPS fora de localhost,
recusa credenciais, query, fragmento, redirecionamento e base path, valida o
contrato mínimo das duas respostas e emite apenas sucesso ou falha.

A URL fica no secret `SANDBOX_API_URL`, evitando sua impressão nos logs. Sem o
secret, a execução registra explicitamente que não está configurada e não faz
requisição. Uma falha torna o workflow vermelho; isso fornece detecção no
sandbox, mas não substitui paging, SLA, owner de plantão ou observabilidade de
produção.

Aceita por Mateus Alves Bassane em 2026-09-28, evidência `00001`.
