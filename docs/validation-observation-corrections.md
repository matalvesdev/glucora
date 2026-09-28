# Validação de correções de observações

- versão anterior permanece armazenada como `superseded`;
- nova versão vira a única corrente;
- provenance nova acompanha a correção;
- auditoria é gravada na mesma transação;
- versão esperada bloqueia conflito e repetição acidental;
- consulta retorna somente a versão corrente;
- jornada de navegador cria uma medição, abre a correção, envia a versão esperada
  e substitui a versão corrente exibida sem incluir alerta ou interpretação;
- teste usa dados exclusivamente sintéticos.
