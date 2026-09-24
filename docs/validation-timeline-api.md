# Validação da leitura da timeline própria

O endpoint `GET /v1/timeline` exige autenticação, conta ativa, finalidade
publicada `self_care_health_data` e consentimento vigente. Ele lê somente a
projeção reconstruível do próprio titular, pagina com cursor opaco e aceita
filtros estruturados de período, origem e categoria. Não grava payload clínico
em logs.

A resposta devolve origem, classe factual, instante e categoria codificada.
O estado vazio é explícito e não representa um evento negativo. A interface
não exibe diagnóstico, alertas, faixas, recomendações nem inferências.

A interface aplica exclusivamente os filtros de origem e período previstos no
contrato, mantém o cursor opaco fora de campos editáveis e oferece retorno à
primeira página. Não permite entrada de categoria, texto livre ou valor de
saúde como filtro.
