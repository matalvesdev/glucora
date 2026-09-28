# Validação — sinais operacionais e resposta a incidentes

- HTTP metrics recebem somente método, route template, status e duração.
- Falhas de readiness possuem contador separado sem erro/URL/payload.
- Teste usa canary sintético em query/header/error e comprova ausência no sink.
- Runbook cobre stop conditions, contenção, evidência mínima, recovery e closure.
- Threat review cobre dados canônicos, projeção, sharing, direitos e IA, registrando dependências ainda bloqueadas.
- O monitor do sandbox rejeita URL insegura, credenciais, query, fragmento,
  redirecionamento, status não saudável e resposta fora do contrato.
- A saída do monitor contém apenas sucesso ou falha e nunca a URL ou o corpo.
