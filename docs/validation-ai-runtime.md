# Validação — runtime de IA

- Capability inexistente e R2+ abstêm antes do provider.
- Falha de autorização/consentimento ocorre antes de geração.
- Evidência insuficiente ou de versão divergente produz fallback.
- Indisponibilidade, exceção, schema inválido e guard bloqueado abstêm com reason code.
- Resultado aceito expõe somente metadata de trace e referências de evidência; não há prompt/resposta em telemetry.
- Testes são inteiramente sintéticos e nenhuma capability real/provider foi ativado.
