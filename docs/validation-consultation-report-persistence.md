# Validação — persistência de relatório de consulta

- Snapshot é imutável e associa cada item da timeline à versão usada.
- Contagem total precisa coincidir com o número de referências.
- Idempotência retorna o mesmo relatório para o mesmo hash e rejeita reutilização divergente.
- Relatório, referências e auditoria são gravados atomicamente.
- Consulta exige `id` e `user_id`, evitando leitura entre usuários.
