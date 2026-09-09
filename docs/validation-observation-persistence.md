# Validação da persistência de observações

- migration aplicada duas vezes no PostgreSQL real sem drift;
- provenance e observação gravadas atomicamente;
- FK composta impede provenance de outro usuário;
- valor decimal retorna sem perda numérica;
- consulta corrente exige `user_id`, evitando leitura cruzada;
- alteração direta de valor é rejeitada;
- fixtures exclusivamente sintéticas.
