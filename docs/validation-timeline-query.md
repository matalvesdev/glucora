# Validação — consulta interna de timeline

- O application service nega acesso antes de consultar a projeção quando identidade, ownership, finalidade ou consentimento falham.
- Filtros são limitados a período, categoria e origem, com página máxima de 100 e cursor estável.
- Agrupamento usa o timezone preservado do evento.
- Estado vazio comunica semanticamente que ausência de registro não prova ausência de acontecimentos.
- Nenhum endpoint foi ativado sem finalidade de consentimento aprovada.
