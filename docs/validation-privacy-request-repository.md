# Validação — repository de solicitações de privacidade

- Criação grava estado inicial, evento append-only e auditoria na mesma transação.
- Repetição com a mesma chave/hash retorna o resultado original; colisão divergente falha.
- Transição bloqueia versão obsoleta, mudança inválida e acesso entre usuários.
- PostgreSQL protege campos imutáveis, incrementos de versão, transições e deleção direta.
- Eventos e auditoria não contêm documentos, justificativas livres ou payload de saúde.
