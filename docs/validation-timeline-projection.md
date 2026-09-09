# Validação — projeção de timeline

- Rebuild transacional lê apenas versões canônicas atuais de observações e eventos contextuais.
- Cada item preserva origem, versão, classe factual, tipo de fonte e contexto temporal.
- A projeção omite valores e notas livres e pode ser reconstruída por usuário.
- Consulta exige ownership, limita páginas a 100 itens e usa cursor temporal estável.
