# ADR-018: persistência canônica de observações e provenance

Status: **ACCEPTED**

Observações quantitativas serão armazenadas no PostgreSQL em versões, com decimal exato, unidade, tempos, classe factual e vínculo obrigatório a provenance do mesmo usuário. A criação inicial grava provenance e observação na mesma transação. Atualizações de conteúdo e exclusões diretas são bloqueadas; uma futura correção somente poderá marcar a versão anterior como superseded e inserir outra versão.

Esta proposta não habilita captura, não define catálogo clínico e não determina finalidade ou retenção. Endpoint e UI continuam bloqueados até aprovação de Product, Clinical e Compliance.
