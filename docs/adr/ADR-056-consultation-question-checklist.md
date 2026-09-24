# ADR-056: checklist de perguntas para preparação de consulta

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-24, com evidência `00001`.

## Contexto

O relatório determinístico da ADR-055 ajuda o titular a organizar registros,
mas não oferece um modo seguro de preparar temas para conversa. Notas livres
criariam uma categoria aberta de conteúdo pessoal e de saúde que requer
finalidade, retenção e revisão operacional próprias.

## Decisão

O titular pode selecionar perguntas de uma lista fechada e não clínica para um
relatório de consulta próprio. Cada item é uma chave controlada, vinculada a
um relatório existente, criada com idempotência, ownership, finalidade
publicada, consentimento vigente e auditoria. A interface permite adicionar e
remover a seleção pelo próprio titular.

As chaves iniciais são `review_records`, `discuss_routine` e
`clarify_next_steps`. Elas não fazem afirmações sobre o estado de saúde,
tratamento, medicação, conduta ou diagnóstico e não são geradas por IA.

## Controles

- não há texto livre, valor clínico, campo adicional, dedução ou recomendação;
- uma pergunta não é dado clínico canônico nem altera o relatório imutável;
- remoção é versionada no seu próprio ledger e auditada; não apaga o relatório;
- toda leitura e mudança é restrita ao titular e falha sem consentimento.

## Limites

Esta decisão não aprova notas livres, perguntas geradas, aconselhamento
clínico, IA, compartilhamento, exportação ou acesso profissional.
