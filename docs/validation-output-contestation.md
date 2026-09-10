# Validação — contestação de outputs

- Registro é append-only, versionado pela referência do output e limitado a motivos controlados.
- Payload do output e texto livre não são copiados.
- Relatório contestado precisa pertencer ao usuário; lookup também é user-scoped.
- Registro e auditoria são atômicos.
- Função determinística remove contestados de reutilização futura sem tratar ausência de contestação como aprovação.
