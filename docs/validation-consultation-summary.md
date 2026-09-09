# Validação — resumo determinístico para consulta

- Período usa intervalo UTC semiaberto `[from, to)` e rejeita ordem inválida.
- Todo item precisa estar dentro do período; geração anterior ao fim do período é rejeitada.
- Saída contém somente contagens determinísticas e limitações fixas.
- Período vazio é distinguido e não vira afirmação negativa.
- Não há interpretação, recomendação clínica, IA, persistência ou endpoint público.
