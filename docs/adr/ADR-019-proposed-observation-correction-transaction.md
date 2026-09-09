# ADR-019: correção transacional de observações

Status: **PROPOSED**

Uma correção bloqueia a versão corrente, marca essa versão como `superseded`, insere nova provenance e nova versão e grava auditoria na mesma transação PostgreSQL. Falha em qualquer etapa desfaz todo o conjunto. A versão esperada evita correções concorrentes silenciosas.

A camada de persistência de Measurements reutiliza o writer interno de Audit como exceção documentada à separação entre módulos, exclusivamente para manter atomicidade. Nenhuma leitura de tabelas internas de Audit é feita pelo módulo.

Não há endpoint nesta etapa. Autorização, finalidade, retenção real e experiência de confirmação continuam pendentes.
