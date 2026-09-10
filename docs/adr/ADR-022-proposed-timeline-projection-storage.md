# ADR-022: armazenamento da projeção de timeline

Status: ACCEPTED

## Contexto e proposta

ADR-005 exige timeline derivada e reconstruível. Propõe-se uma tabela PostgreSQL separada do schema canônico, contendo apenas referências de origem/versão e metadados necessários à ordenação e apresentação. Um rebuild por usuário substitui a projeção inteira dentro de uma transação e usa lock consultivo para serializar rebuilds concorrentes.

O MVP reutiliza PostgreSQL para evitar um novo provider. A projeção não contém valores de medições nem notas livres, pode ser apagada e recriada dos registros canônicos atuais e nunca serve para corrigir a origem.

## Consequências

Consultas cronológicas e filtros básicos não leem payload clínico desnecessário. Atualização incremental, execução assíncrona e política de refresh permanecem decisões posteriores.
