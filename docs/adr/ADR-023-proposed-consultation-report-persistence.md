# ADR-023: persistência de relatórios determinísticos de consulta

Status: ACCEPTED

## Contexto e proposta

E3/E7 exige relatório reproduzível e auditável. Propõe-se um snapshot imutável do resumo determinístico, com período, contagens, limitações e referências exatas aos itens/versões da timeline. A criação é idempotente por usuário e inclui auditoria na mesma transação.

O relatório não vira registro clínico canônico e não contém interpretação, recomendação, valores de medição ou notas livres. Exportação e compartilhamento serão artefatos derivados separados, sujeitos a consentimento, retenção e revogação.

## Consequências

O conteúdo pode ser explicado e ligado às versões usadas. Mudanças posteriores não reescrevem o relatório criado. Política real de retenção, textos e exposição continuam bloqueados pelos gates aplicáveis.
