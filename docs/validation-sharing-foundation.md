# Validação — compartilhamento controlado

- A autorização exige coincidência de destinatário, artefato e finalidade.
- Grant revogado, expirado, ainda não vigente ou ausente é negado.
- PostgreSQL limita o grant a relatório existente, finalidade versionada e destinatário opaco.
- Apenas a transição ativa → revogada altera o registro; todo outro update/delete falha.
- Nenhum dado de contato ou payload de saúde é armazenado no grant.
- Criação confirma ownership do relatório e criação/revogação gravam auditoria na mesma transação.
