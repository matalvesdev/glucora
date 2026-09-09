# Validação de tempo, catálogo e consultas

- zona IANA e offset são conferidos no instante UTC observado;
- timezone inválido ou offset incoerente são rejeitados;
- tipo/unidade ausentes do catálogo são negados;
- nenhum código ou unidade clínica foi presumido;
- query retorna apenas versões correntes do usuário;
- limite fora de 1–100 é rejeitado;
- migration exige backfill explícito se encontrar dados anteriores.
