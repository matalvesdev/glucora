# Validação do núcleo de observações

- valor decimal é preservado sem uso de ponto flutuante;
- tipo e unidade são explícitos e codificados;
- timestamps exigem ISO-8601 UTC e ordem temporal coerente;
- origem e provenance são obrigatórios;
- `INFERENCE` não pode ser persistida como medição original;
- nenhuma faixa, conversão ou interpretação clínica foi introduzida.

ADR-017 permanece `PROPOSED`. A entrega cobre C1 no domínio e não habilita captura de dados de saúde.
