# Validação — captura manual inicial de glicose

Referências: ADR-017, ADR-018, ADR-020, ADR-042 e ADR-052.

## Escopo do slice

`POST /v1/observations` aceita somente uma medição manual de glicose do
titular: LOINC `2339-0`, unidade `mg/dL` e método
`capillary_user_reported`. O contrato não aceita tipo, unidade, contexto,
faixa, alerta ou texto livre do cliente.

## Controles verificados

- autenticação, conta ativa, ownership e consentimento vigente para a
  finalidade publicada `self_care_health_data` são exigidos antes da gravação;
- a observação mantém decimal textual exato, instante UTC, zona IANA e offset;
- provenance preserva inserção manual e método capilar declarado, sem inferir
  jejum, refeição, exercício, medicação, sintomas ou interpretação clínica;
- catálogo é deny-by-default e não converte unidade;
- idempotência, provenance, observação e auditoria são persistidas em uma
  transação; reutilização da chave com conteúdo diferente retorna conflito;
- logs e métricas não recebem valor, payload, URL, token ou cabeçalhos de saúde;
- exclusão canônica remove a evidência de idempotência antes de remover a
  observação, preservando a política de exclusão da ADR-043.

## Evidência automatizada

- `tests/observation.test.ts`: par permitido e negação de unidade ausente do
  catálogo;
- `tests/api.test.ts`: contrato, consentimento, provenance controlada e
  conflito de idempotência;
- `tests/integration/postgres.test.ts`: migration, gravação real, retry,
  conflito e compatibilidade com exclusão canônica.
- `tests/e2e/shell.spec.ts`: formulário autenticado, payload mínimo e estado de
  sucesso sem alerta ou interpretação.

Não há timeline, faixas, alertas, conversão, importação de dispositivo,
diagnóstico, prescrição ou beta neste slice.
